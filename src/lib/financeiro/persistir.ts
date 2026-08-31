import type { SupabaseClient } from "@supabase/supabase-js";
import { planejarLinhas, type LinhaPlanejada } from "./planejar";
import { mapearRegistros } from "./registros";
import type { NovoLancamento } from "./tipos";

export async function persistirLancamento(
  supabase: SupabaseClient,
  ctx: { householdId: string; criadoPor: string; grupoImportacao?: string | null; recorrenteId?: string | null; contaPagarId?: string | null },
  l: NovoLancamento,
  diaFechamentoConhecido?: number | null,
  // Import de fatura: joga a linha nesta fatura (competência), como cobrança
  // única, SEM espalhar parcelas nem redistribuir por data.
  competenciaForcada?: { ano: number; mes: number } | null,
  // Import de fatura: liga esta linha à compra parcelada (grupo/parcela atual),
  // pra acompanhar quantas faltam entre faturas. Só usado com competenciaForcada.
  parcelaInfo?: { grupo_parcela: string | null; parcela_n: number; total_parcelas: number } | null,
): Promise<{ error: string | null }> {
  // dia de fechamento do cartão (só precisa quando vamos calcular a competência)
  let diaFechamento: number | null = null;
  if (l.card_id && !competenciaForcada) {
    if (diaFechamentoConhecido !== undefined) {
      diaFechamento = diaFechamentoConhecido;
    } else {
      const { data: card } = await supabase.from("cards").select("dia_fechamento").eq("id", l.card_id).single();
      if (!card) return { error: "cartão inexistente" };
      diaFechamento = card.dia_fechamento;
    }
  }
  if (l.account_id) {
    const { data: conta } = await supabase.from("accounts").select("id").eq("id", l.account_id).maybeSingle();
    if (!conta) return { error: "conta inexistente" };
  }

  const linhas: LinhaPlanejada[] = (competenciaForcada && l.card_id)
    ? [{
        tipo: l.tipo, valor_centavos: l.valor_centavos, data_compra: l.data_compra,
        categoria_id: l.categoria_id ?? null, pessoa: l.pessoa,
        account_id: null, card_id: l.card_id,
        grupo_parcela: parcelaInfo?.grupo_parcela ?? null,
        parcela_n: parcelaInfo?.parcela_n ?? 1,
        total_parcelas: parcelaInfo?.total_parcelas ?? 1,
        descricao: l.descricao ?? null,
        invoiceCompetencia: { ano: competenciaForcada.ano, mes: competenciaForcada.mes },
      }]
    : planejarLinhas(l, diaFechamento);

  const invoiceIdPorComp = new Map<string, string>();
  for (const linha of linhas) {
    if (!linha.invoiceCompetencia || !l.card_id) continue;
    const chave = `${linha.invoiceCompetencia.ano}-${linha.invoiceCompetencia.mes}`;
    if (invoiceIdPorComp.has(chave)) continue;
    const { data: inv, error: invoiceError } = await supabase
      .from("invoices")
      .upsert(
        {
          household_id: ctx.householdId, card_id: l.card_id,
          competencia_ano: linha.invoiceCompetencia.ano,
          competencia_mes: linha.invoiceCompetencia.mes,
        },
        { onConflict: "card_id,competencia_ano,competencia_mes" },
      )
      .select("id").single();
    if (invoiceError || !inv) return { error: "falha ao gerar fatura" };
    invoiceIdPorComp.set(chave, inv.id);
  }

  const registros = mapearRegistros(linhas, invoiceIdPorComp, {
    householdId: ctx.householdId, criadoPor: ctx.criadoPor, origemIa: l.origem_ia ?? false,
    grupoImportacao: ctx.grupoImportacao ?? null, recorrenteId: ctx.recorrenteId ?? null,
    contaPagarId: ctx.contaPagarId ?? null,
  });
  const { error } = await supabase.from("transactions").insert(registros);
  return { error: error ? error.message : null };
}
