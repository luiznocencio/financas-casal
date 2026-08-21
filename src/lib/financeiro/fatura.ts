export type Competencia = { ano: number; mes: number }; // mes: 1-12

/** Avança a competência em um mês, virando o ano se necessário. */
export function proximaCompetencia(c: Competencia): Competencia {
  return c.mes === 12 ? { ano: c.ano + 1, mes: 1 } : { ano: c.ano, mes: c.mes + 1 };
}

/**
 * Competência (fatura) em que a compra cai, dado o dia de fechamento do cartão.
 * Compra com dia <= fechamento -> mês da compra; senão -> mês seguinte.
 */
export function competenciaDaCompra(dataCompra: Date, diaFechamento: number): Competencia {
  const base: Competencia = { ano: dataCompra.getFullYear(), mes: dataCompra.getMonth() + 1 };
  return dataCompra.getDate() <= diaFechamento ? base : proximaCompetencia(base);
}
