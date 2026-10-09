import { competenciaDePagamento, type Competencia } from "./fatura";

// Quanto um lançamento pesa na fatura: compra soma, estorno/crédito (receita) abate.
export function valorNaFatura(t: { valor_centavos: number; tipo?: string | null }): number {
  return t.tipo === "receita" ? -t.valor_centavos : t.valor_centavos;
}

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
  txs: { invoice_id: string | null; valor_centavos: number; tipo?: string | null }[],
): FaturaResumo[] {
  const totalPorFatura = new Map<string, number>();
  for (const t of txs) {
    if (!t.invoice_id) continue;
    totalPorFatura.set(t.invoice_id, (totalPorFatura.get(t.invoice_id) ?? 0) + valorNaFatura(t));
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

const idxComp = (c: Competencia) => c.ano * 12 + c.mes;

// Fatura ATUAL de um cartão numa data: a que está recebendo as compras feitas
// nesse dia (competência = mês em que ela vence). Ex.: Nubank fecha dia 30 e
// vence dia 7 → compra em 09/10 cai na fatura de novembro.
export function faturaAtualDoCartao(
  card: { dia_fechamento: number; dia_vencimento: number },
  data: { ano: number; mes: number; dia: number },
): Competencia {
  return competenciaDePagamento(new Date(data.ano, data.mes - 1, data.dia), card.dia_fechamento, card.dia_vencimento);
}

// Faturas EM ABERTO de um cartão que contam agora: as não pagas até a fatura
// atual (inclui uma anterior que ainda não foi paga). Faturas futuras — que só
// têm parcelas lançadas adiante — ficam de fora.
export function faturasEmAbertoAteAtual<I extends { competencia_ano: number; competencia_mes: number; status: string }>(
  invoices: I[],
  atual: Competencia,
): I[] {
  return invoices.filter((i) => i.status !== "paga" && idxComp({ ano: i.competencia_ano, mes: i.competencia_mes }) <= idxComp(atual));
}
