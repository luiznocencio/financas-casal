import { NextResponse } from "next/server";
import { interpretarImportacao, detectarTotalFatura, cortarSecaoFuturas } from "@/lib/importacao/extrair";
import { marcarDuplicados } from "@/lib/importacao/duplicados";
import { chamarModeloJson } from "@/lib/ai/openai";
import { getMembroAtual } from "@/lib/auth/household";
import { createServerSupabase } from "@/lib/supabase/server";
import { nomeBase, nomeComMarcador } from "@/lib/importacao/parcelas";
import { ultimoDiaDoMes } from "@/lib/financeiro/fechamento";

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
    const linhas = await interpretarImportacao(textoExtrair, chamarModeloJson, totalFaturaCentavos);

    const supabase = await createServerSupabase();

    // regras aprendidas (casamento por NOME BASE: ignora marcador de parcela e
    // código de loja, então a regra vale pra mesma compra em qualquer mês)
    const { data: regras } = await supabase.from("category_rules").select("chave, categoria_id, descricao_preferida");
    const porChave = new Map((regras ?? []).map((r) => [r.chave, r]));

    // gastos fixos deste cartão: casa por nome base pra pré-marcar "fixo" e sugerir
    // a categoria do próprio fixo, sem o usuário precisar marcar na mão.
    const fixoPorBase = new Map<string, string | null>();
    if (origem.card_id) {
      const { data: recs } = await supabase.from("recorrentes").select("descricao, categoria_id").eq("card_id", origem.card_id);
      for (const r of recs ?? []) if (r.descricao) fixoPorBase.set(nomeBase(r.descricao), r.categoria_id ?? null);
    }

    // categoria já usada antes pra essa compra (qualquer origem, mais recente) —
    // reconhece o que foi categorizado num import anterior mesmo sem virar regra.
    const { data: categorizadas } = await supabase
      .from("transactions").select("descricao, categoria_id, data_compra")
      .not("categoria_id", "is", null).order("data_compra", { ascending: false });
    const catPorBase = new Map<string, string>();
    for (const t of categorizadas ?? []) {
      const b = nomeBase(t.descricao ?? "");
      if (b && !catPorBase.has(b)) catPorBase.set(b, t.categoria_id); // 1ª ocorrência = mais recente
    }

    const comRegra = linhas.map((l) => {
      const base = nomeBase(l.descricao);
      const regra = porChave.get(base);
      const descricao = regra?.descricao_preferida ? nomeComMarcador(regra.descricao_preferida, l.descricao) : l.descricao;
      const ehFixo = fixoPorBase.has(base);
      // categoria: regra > categoria do gasto fixo > categoria usada antes
      const categoria_id = (regra?.categoria_id ?? fixoPorBase.get(base) ?? catPorBase.get(base) ?? null) as string | null;
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
      const { data } = await supabase
        .from("transactions").select("id, data_compra, valor_centavos, tipo, descricao, recorrente_id").eq(origemCol, origemId);
      for (const t of data ?? []) addTx(t);
    }
    // gastos fixos já materializados na casa toda (RLS já limita ao household).
    // Escopa ao MÊS da fatura importada: não pode reconhecer (nem sobrescrever)
    // um fixo ligado a OUTRA fatura/mês.
    let recQuery = supabase
      .from("transactions").select("id, data_compra, valor_centavos, tipo, descricao, recorrente_id").not("recorrente_id", "is", null);
    if (competencia) {
      const ini = `${competencia.ano}-${pad(competencia.mes)}-01`;
      const fim = `${competencia.ano}-${pad(competencia.mes)}-${pad(ultimoDiaDoMes(competencia.ano, competencia.mes))}`;
      recQuery = recQuery.gte("data_compra", ini).lte("data_compra", fim);
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
