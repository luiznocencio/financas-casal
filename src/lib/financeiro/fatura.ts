import { ultimoDiaDoMes } from "./fechamento";

export type Competencia = { ano: number; mes: number }; // mes: 1-12

/** Avança a competência em um mês, virando o ano se necessário. */
export function proximaCompetencia(c: Competencia): Competencia {
  return c.mes === 12 ? { ano: c.ano + 1, mes: 1 } : { ano: c.ano, mes: c.mes + 1 };
}

/**
 * Competência (fatura) em que a compra cai, dado o dia de fechamento do cartão.
 * Compra ANTES do dia de fechamento -> mês da compra; no dia do fechamento em
 * diante -> mês seguinte (a fatura desse ciclo já fechou). Em mês curto, o
 * fechamento "encosta" no último dia (ex.: fechamento 31 em fevereiro = 28/29).
 */
export function competenciaDaCompra(dataCompra: Date, diaFechamento: number): Competencia {
  const base: Competencia = { ano: dataCompra.getFullYear(), mes: dataCompra.getMonth() + 1 };
  const fechamentoEfetivo = Math.min(diaFechamento, ultimoDiaDoMes(base.ano, base.mes));
  return dataCompra.getDate() < fechamentoEfetivo ? base : proximaCompetencia(base);
}

/**
 * Competência de PAGAMENTO: o mês em que a fatura da compra VENCE (é paga). É a
 * régua que o casal usa ("penso na fatura pelo mês em que pago"). Parte do mês de
 * fechamento e, se o vencimento cai depois do fechamento, vence no mesmo mês;
 * senão (fecha no fim do mês, vence no começo do outro) vence no mês seguinte.
 */
export function competenciaDePagamento(dataCompra: Date, diaFechamento: number, diaVencimento: number): Competencia {
  const fecha = competenciaDaCompra(dataCompra, diaFechamento);
  return diaVencimento > diaFechamento ? fecha : proximaCompetencia(fecha);
}
