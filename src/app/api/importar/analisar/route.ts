import { NextResponse } from "next/server";
import { interpretarImportacao, detectarTotalFatura, cortarSecaoFuturas } from "@/lib/importacao/extrair";
import { marcarDuplicados } from "@/lib/importacao/duplicados";
import { chamarModeloJson } from "@/lib/ai/openai";
import { getMembroAtual } from "@/lib/auth/household";
import { createServerSupabase } from "@/lib/supabase/server";
import { nomeBase, nomeComMarcador } from "@/lib/importacao/parcelas";
import { indexarRegras, regraEfetiva } from "@/lib/importacao/regras";
import { ultimoDiaDoMes } from "@/lib/financeiro/fechamento";
import { todas } from "@/lib/supabase/todas";

const pad = (n: number) => String(n).padStart(2, "0");

export async function POST(req: Request) {
  // exige usuário logado antes de gastar chamada à OpenAI
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const body = await req.json();
    const texto = body?.texto;
    const origem: { card_id?: string; account_id?: string } = body?.origem ?? {};
    const cmp = body?.competencia;
    const competencia = cmp && cmp.ano >= 2000 && cmp.mes >= 1 && cmp.mes <= 12
      ? { ano: Number(cmp.ano), mes: Number(cmp.mes) } : null;
    if (!texto || typeof texto !== "string") return NextResponse.json({ ok: false });
    // fatura de cartão: detecta o total, remove a seção de próximas faturas e ancora a extração
    const totalFaturaCentavos = origem.card_id ? detectarTotalFatura(texto) : null;
    const textoExtrair = origem.card_id ? cortarSecaoFuturas(texto) : texto;
    const linhas = await interpretarImportacao(textoExtrair, chamarModeloJson, totalFaturaCentavos, !!origem.card_id);

    const supabase = await createServerSupabase();

    // regras aprendidas (casamento por NOME BASE: ignora marcador de parcela e
    // código de loja). A regra DESTE cartão tem prioridade sobre a da casa — o
    // mesmo texto do banco (ex.: TOTALPASS) pode ter nomes diferentes por cartão.
    const { data: regras } = await supabase.from("category_rules").select("chave, card_id, categoria_id, descricao_preferida");
    const porChave = indexarRegras(regras ?? []);
    const cardId = origem.card_id ?? null;

    // gastos fixos deste cartão: casa por nome base pra pré-marcar "fixo" e sugerir
    // a categoria do próprio fixo, sem o usuário precisar marcar na mão.
    const fixoPorBase = new Map<string, string | null>();
    if (origem.card_id) {
      const { data: recs } = await supabase.from("recorrentes").select("descricao, categoria_id").eq("card_id", origem.card_id);
      for (const r of recs ?? []) if (r.descricao) fixoPorBase.set(nomeBase(r.descricao), r.categoria_id ?? null);
    }

    // categoria já usada antes pra essa compra (mais recente) — reconhece o que
    // foi categorizado num import anterior mesmo sem virar regra. Prefere o que
    // foi usado NESTE cartão; senão, em qualquer origem.
    const { data: categorizadas } = await todas((de, ate) => supabase
      .from("transactions").select("descricao, categoria_id, data_compra, card_id")
      .not("categoria_id", "is", null).order("data_compra", { ascending: false }).order("id").range(de, ate));
    const catPorBase = new Map<string, string>();
    const catPorBaseCartao = new Map<string, string>();
    for (const t of categorizadas ?? []) {
      const b = nomeBase(t.descricao ?? "");
      if (!b) continue;
      if (!catPorBase.has(b)) catPorBase.set(b, t.categoria_id); // 1ª ocorrência = mais recente
      if (cardId && t.card_id === cardId && !catPorBaseCartao.has(b)) catPorBaseCartao.set(b, t.categoria_id);
    }

    const comRegra = linhas.map((l) => {
      const base = nomeBase(l.descricao);
      const regra = regraEfetiva(porChave, base, cardId);
      const descricao = regra?.descricao_preferida ? nomeComMarcador(regra.descricao_preferida, l.descricao) : l.descricao;
      // fixo: reconhece pelo texto do banco OU pelo nome já aplicado (o fixo pode ter
      // sido renomeado — "TOTALPASS" no banco, "Totalpass Luiz" no cadastro)
      const baseAplicada = nomeBase(descricao);
      const chaveFixo = fixoPorBase.has(base) ? base : fixoPorBase.has(baseAplicada) ? baseAplicada : null;
      const ehFixo = chaveFixo !== null;
      const catFixo = chaveFixo !== null ? fixoPorBase.get(chaveFixo) : null;
      // categoria: regra > categoria do gasto fixo > usada antes neste cartão > usada antes
      const categoria_id = (regra?.categoria_id ?? catFixo ?? catPorBaseCartao.get(base) ?? catPorBase.get(base) ?? null) as string | null;
      // guarda o texto cru do banco pra aprender no confirmar o que for ajustado aqui
      return { ...l, descricao, descricao_original: l.descricao, categoria_id, fixo: ehFixo };
    });

    // marca o que já existe (não duplicar fatura x lançamento manual). Combina
    // (a) transações da mesma origem e (b) gastos fixos já materializados em
    // QUALQUER origem da casa (fixo lançado noutro cartão também é duplicado),
    // deduplicando por id da transação.
    const origemCol = origem.card_id ? "card_id" : origem.account_id ? "account_id" : null;
    const origemId = origem.card_id ?? origem.account_id ?? null;
    const porId = new Map<string, { data_compra: string; valor_centavos: number; tipo: string; descricao: string; recorrente: boolean }>();
    const addTx = (t: { id: string; data_compra: string; valor_centavos: number; tipo: string; descricao: string; recorrente_id: string | null }) => {
      porId.set(t.id, {
        data_compra: t.data_compra, valor_centavos: t.valor_centavos, tipo: t.tipo,
        descricao: t.descricao, recorrente: t.recorrente_id != null,
      });
    };
    if (origemCol && origemId) {
      const { data } = await todas((de, ate) => supabase
        .from("transactions").select("id, data_compra, valor_centavos, tipo, descricao, recorrente_id").eq(origemCol, origemId).order("id").range(de, ate));
      for (const t of data ?? []) addTx(t);
    }
    // gastos fixos já materializados NESTA origem (o cartão da fatura). Não olha
    // outros cartões: o casal tem assinaturas iguais (TotalPass, WellHub) cada um
    // no seu cartão, e uma não pode anular a outra. Escopa também ao MÊS da
    // fatura importada: não reconhece (nem sobrescreve) um fixo de OUTRO mês.
    let recQuery = supabase
      .from("transactions").select("id, data_compra, valor_centavos, tipo, descricao, recorrente_id").not("recorrente_id", "is", null);
    if (origemCol && origemId) recQuery = recQuery.eq(origemCol, origemId);
    if (competencia) {
      if (origem.card_id) {
        // cartão: os fixos que estão NA fatura importada (o fixo de outubro de um
        // cartão que fecha no fim do mês mora na fatura de novembro, com data de outubro)
        const { data: inv } = await supabase.from("invoices").select("id")
          .eq("card_id", origem.card_id).eq("competencia_ano", competencia.ano).eq("competencia_mes", competencia.mes).maybeSingle();
        recQuery = recQuery.eq("invoice_id", inv?.id ?? "00000000-0000-0000-0000-000000000000");
      } else {
        const ini = `${competencia.ano}-${pad(competencia.mes)}-01`;
        const fim = `${competencia.ano}-${pad(competencia.mes)}-${pad(ultimoDiaDoMes(competencia.ano, competencia.mes))}`;
        recQuery = recQuery.gte("data_compra", ini).lte("data_compra", fim);
      }
    }
    const { data: recorrentes } = await recQuery;
    for (const t of recorrentes ?? []) addTx(t);

    const existentes = [...porId.values()];
    const comDup = marcarDuplicados(comRegra, existentes);

    return NextResponse.json({ ok: true, linhas: comDup, totalFaturaCentavos });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
