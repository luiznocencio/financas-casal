import type { SupabaseClient } from "@supabase/supabase-js";
import { planejarLinhas } from "./planejar";
import { mapearRegistros } from "./registros";
import type { NovoLancamento } from "./tipos";

export async function persistirLancamento(
  supabase: SupabaseClient,
  ctx: { householdId: string; criadoPor: string },
  l: NovoLancamento,
  diaFechamentoConhecido?: number | null,
): Promise<{ error: string | null }> {
  // dia de fechamento do cartão (se for cartão)
  let diaFechamento: number | null = null;
  if (l.card_id) {
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

  const linhas = planejarLinhas(l, diaFechamento);

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
  });
  const { error } = await supabase.from("transactions").insert(registros);
  return { error: error ? error.message : null };
}
