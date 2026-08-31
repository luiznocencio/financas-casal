import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";
import { persistirLancamento } from "@/lib/financeiro/persistir";
import type { NovoLancamento } from "@/lib/financeiro/tipos";
import { normalizeDescricao } from "@/lib/financeiro/descricao";
import { ultimoDiaDoMes } from "@/lib/financeiro/fechamento";
import { lerParcela, assinaturaParcela } from "@/lib/importacao/parcelas";

const DIA_MS = 86_400_000;
function diasMs(iso: string): number {
  return new Date(iso + "T12:00:00").getTime();
}
const pad = (n: number) => String(n).padStart(2, "0");

type ItemImport = {
  data: string; descricao: string; valor_centavos: number;
  tipo: "despesa" | "receita"; total_parcelas: number;
  categoria_id: string | null; pessoa: string;
};

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const origem: { card_id?: string; account_id?: string } = body.origem ?? {};
  const itens: ItemImport[] = Array.isArray(body.linhas) ? body.linhas : [];
  if (!origem.card_id && !origem.account_id) return NextResponse.json({ error: "origem inválida" }, { status: 400 });

  // import de fatura: todas as linhas entram nesta fatura (mês), sem espalhar parcelas
  const c = body.competencia;
  const competencia = origem.card_id && c && c.ano >= 2000 && c.mes >= 1 && c.mes <= 12
    ? { ano: Number(c.ano), mes: Number(c.mes) } : null;

  const supabase = await createServerSupabase();

  // lançamentos já existentes nessa origem, p/ pular duplicados (data + valor)
  const origemCol = origem.card_id ? "card_id" : "account_id";
  const origemId = (origem.card_id ?? origem.account_id) as string;
  const { data: existentes } = await supabase
    .from("transactions").select("data_compra, valor_centavos").eq(origemCol, origemId);
  const chaves = new Set((existentes ?? []).map((e) => `${e.data_compra}|${e.valor_centavos}`));

  // gastos fixos já materializados na casa toda (qualquer origem) — um fixo já
  // lançado noutro cartão/conta também é duplicado. Consumido no máximo 1x por tx
  // (guloso), pra duas linhas fixas iguais não serem ambas suprimidas por 1 só tx.
  // escopado ao mês da fatura importada: não reconhece nem sobrescreve um fixo de OUTRA fatura
  let recQuery = supabase
    .from("transactions").select("data_compra, valor_centavos, tipo, descricao").not("recorrente_id", "is", null);
  if (competencia) {
    const ini = `${competencia.ano}-${pad(competencia.mes)}-01`;
    const fim = `${competencia.ano}-${pad(competencia.mes)}-${pad(ultimoDiaDoMes(competencia.ano, competencia.mes))}`;
    recQuery = recQuery.gte("data_compra", ini).lte("data_compra", fim);
  }
  const { data: recorrentesRaw } = await recQuery;
  const poolRecorrentes = (recorrentesRaw ?? []).map((r) => ({ ...r, usado: false }));

  // dia de fechamento do cartão buscado uma vez para todo o lote (evita 1 SELECT por lançamento)
  let diaFechamento: number | null | undefined = undefined;
  if (origem.card_id) {
    const { data: card } = await supabase.from("cards").select("dia_fechamento").eq("id", origem.card_id).maybeSingle();
    if (!card) return NextResponse.json({ error: "cartão inexistente" }, { status: 400 });
    diaFechamento = card.dia_fechamento;
  }

  // compras parceladas já existentes neste cartão: pra ligar a fatura seguinte à
  // mesma compra (mesmo grupo) e não duplicar uma parcela já lançada (conciliação).
  // { assinatura -> grupo_parcela }, e set de parcelas já vistas "assinatura#n".
  const grupoPorAssinatura = new Map<string, string>();
  const parcelasVistas = new Set<string>();
  if (origem.card_id) {
    const { data: parc } = await supabase.from("transactions")
      .select("grupo_parcela, descricao, total_parcelas, parcela_n")
      .eq("card_id", origem.card_id).gt("total_parcelas", 1);
    for (const p of parc ?? []) {
      const assin = assinaturaParcela(origem.card_id, p.descricao ?? "", p.total_parcelas);
      if (p.grupo_parcela && !grupoPorAssinatura.has(assin)) grupoPorAssinatura.set(assin, p.grupo_parcela);
      parcelasVistas.add(`${assin}#${p.parcela_n}`);
    }
  }

  const grupoImportacao = crypto.randomUUID();

  let criadas = 0;
  let duplicadas = 0;
  const falhas: string[] = [];
  for (const it of itens) {
    if (!(it.valor_centavos > 0) || !DATA_ISO.test(it.data ?? "")) {
      falhas.push(it.descricao || "(sem descrição)");
      continue;
    }
    const chave = `${it.data}|${it.valor_centavos}`;
    if (chaves.has(chave)) { duplicadas++; continue; } // já existe → pula

    // fixo já materializado (qualquer origem): mesmo valor+tipo e ( descrição
    // normalizada igual OU dentro de 27 dias ) → pula sem recriar
    const idxRec = poolRecorrentes.findIndex((r) =>
      !r.usado && r.valor_centavos === it.valor_centavos && r.tipo === it.tipo &&
      (Math.abs(diasMs(r.data_compra) - diasMs(it.data)) <= 27 * DIA_MS ||
        (normalizeDescricao(r.descricao) === normalizeDescricao(it.descricao) && r.data_compra.slice(0, 7) === it.data.slice(0, 7))));
    if (idxRec >= 0) { poolRecorrentes[idxRec].usado = true; duplicadas++; continue; }

    // parcela: "k/M" na descrição tem prioridade sobre o total detectado pela IA
    const marca = lerParcela(it.descricao);
    const totalParcelas = origem.card_id ? Math.min(72, Math.max(1, marca?.total ?? it.total_parcelas ?? 1)) : 1;

    let parcelaInfo: { grupo_parcela: string | null; parcela_n: number; total_parcelas: number } | null = null;
    if (origem.card_id && totalParcelas > 1) {
      const parcelaN = marca?.parcela_n ?? 1;
      const assin = assinaturaParcela(origem.card_id, it.descricao, totalParcelas);
      // conciliação: essa parcela dessa compra já existe (lançada na mão ou reimport) → pula
      if (parcelasVistas.has(`${assin}#${parcelaN}`)) { duplicadas++; continue; }
      const grupo = grupoPorAssinatura.get(assin) ?? crypto.randomUUID();
      grupoPorAssinatura.set(assin, grupo);
      parcelasVistas.add(`${assin}#${parcelaN}`);
      parcelaInfo = { grupo_parcela: grupo, parcela_n: parcelaN, total_parcelas: totalParcelas };
    }

    const novo: NovoLancamento = {
      tipo: it.tipo, valor_centavos: it.valor_centavos, data_compra: it.data,
      categoria_id: it.categoria_id ?? null, pessoa: it.pessoa,
      account_id: origem.account_id ?? null, card_id: origem.card_id ?? null,
      total_parcelas: totalParcelas,
      descricao: it.descricao, origem_ia: true,
    };
    const { error } = await persistirLancamento(
      supabase, { householdId: membro.household_id, criadoPor: membro.user_id, grupoImportacao }, novo, diaFechamento, competencia, parcelaInfo,
    );
    if (error) falhas.push(it.descricao || "(sem descrição)");
    else { criadas++; chaves.add(chave); } // evita duplicar dentro do próprio lote
  }
  return NextResponse.json({ criadas, duplicadas, falhas });
}
