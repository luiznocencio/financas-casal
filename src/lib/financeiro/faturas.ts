export type FaturaResumo = {
  id: string;
  ano: number;
  mes: number;
  totalCentavos: number;
  paga: boolean;
};

/**
 * Agrupa as faturas de um cartão com o total de cada uma (somado das transações
 * ligadas por invoice_id) e o status de pagamento. Ordena por competência crescente.
 */
export function agruparFaturas(
  invoices: { id: string; competencia_ano: number; competencia_mes: number; status: string }[],
  txs: { invoice_id: string | null; valor_centavos: number }[],
): FaturaResumo[] {
  const totalPorFatura = new Map<string, number>();
  for (const t of txs) {
    if (!t.invoice_id) continue;
    totalPorFatura.set(t.invoice_id, (totalPorFatura.get(t.invoice_id) ?? 0) + t.valor_centavos);
  }

  return invoices
    .map((inv) => ({
      id: inv.id,
      ano: inv.competencia_ano,
      mes: inv.competencia_mes,
      totalCentavos: totalPorFatura.get(inv.id) ?? 0,
      paga: inv.status === "paga",
    }))
    .sort((a, b) => a.ano - b.ano || a.mes - b.mes);
}
