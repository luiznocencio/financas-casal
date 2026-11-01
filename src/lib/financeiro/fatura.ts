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
export function competenciaDePagamento(
  dataCompra: Date, diaFechamento: number, diaVencimento: number, diasFechamentoAntes?: number | null,
): Competencia {
  // "fecha N dias antes do vencimento": a data de fechamento muda mês a mês
  // (meses de 28/29/30/31 dias), então procura a fatura pelo calendário de verdade
  if (diasFechamentoAntes != null) {
    return faturaDaCompra(
      { ano: dataCompra.getFullYear(), mes: dataCompra.getMonth() + 1, dia: dataCompra.getDate() },
      { dia_fechamento: diaFechamento, dia_vencimento: diaVencimento, dias_fechamento_antes: diasFechamentoAntes },
    );
  }
  const fecha = competenciaDaCompra(dataCompra, diaFechamento);
  return diaVencimento > diaFechamento ? fecha : proximaCompetencia(fecha);
}

export type Dia = { ano: number; mes: number; dia: number };
export type RegraFatura = { dia_fechamento: number; dia_vencimento: number; dias_fechamento_antes?: number | null };

const ordemDia = (d: Dia) => d.ano * 10000 + d.mes * 100 + d.dia;
function competenciaAnterior(c: Competencia): Competencia {
  return c.mes === 1 ? { ano: c.ano - 1, mes: 12 } : { ano: c.ano, mes: c.mes - 1 };
}

/** Dia em que vence a fatura de competência `c` (vencimento 31 em mês curto = último dia). */
export function vencimentoDaFatura(r: RegraFatura, c: Competencia): Dia {
  return { ...c, dia: Math.min(r.dia_vencimento, ultimoDiaDoMes(c.ano, c.mes)) };
}

/**
 * Dia em que fecha a fatura que vence na competência `c`. Com "N dias antes", é o
 * vencimento menos N dias corridos (vence 07/11 e fecha 7 antes → 31/10; vence
 * 07/12 → 30/11; vence 07/03 → 28/02). Sem isso (cartão antigo), o dia fixo de
 * fechamento, no mês do vencimento ou no anterior.
 */
export function fechamentoDaFatura(r: RegraFatura, c: Competencia): Dia {
  if (r.dias_fechamento_antes != null) {
    const v = vencimentoDaFatura(r, c);
    const d = new Date(Date.UTC(v.ano, v.mes - 1, v.dia - Math.round(r.dias_fechamento_antes)));
    return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
  }
  const mesF = r.dia_fechamento < r.dia_vencimento ? c : competenciaAnterior(c);
  return { ...mesF, dia: Math.min(r.dia_fechamento, ultimoDiaDoMes(mesF.ano, mesF.mes)) };
}

/**
 * Fatura (competência = mês do vencimento) em que cai uma compra: a primeira que
 * fecha DEPOIS do dia da compra. Compra no próprio dia do fechamento já vai pra
 * fatura seguinte.
 */
export function faturaDaCompra(compra: Dia, r: RegraFatura): Competencia {
  let c = competenciaAnterior({ ano: compra.ano, mes: compra.mes });
  for (let i = 0; i < 4; i++) {
    if (ordemDia(fechamentoDaFatura(r, c)) > ordemDia(compra)) return c;
    c = proximaCompetencia(c);
  }
  return c;
}

/** Alguma fatura do cartão fecha exatamente no dia `d`? (pro aviso de "fecha amanhã") */
export function faturaFechaNoDia(r: RegraFatura, d: Dia): boolean {
  let c: Competencia = { ano: d.ano, mes: d.mes };
  for (let i = 0; i < 3; i++) {
    if (ordemDia(fechamentoDaFatura(r, c)) === ordemDia(d)) return true;
    c = proximaCompetencia(c);
  }
  return false;
}

/**
 * Mês de CONSUMO de uma fatura: o mês que o ciclo dela mais cobre (dia do
 * fechamento − 15). Ex.: Nubank que fecha 30/11 (vence 07/12) é "a fatura de
 * novembro" — uma compra no cartão em 31/10, já depois do fechamento de outubro,
 * conta em novembro. Itaú que fecha 04/11 (vence 10/11) é a "de outubro".
 */
export function mesDaFatura(r: RegraFatura, c: Competencia): Competencia {
  const f = fechamentoDaFatura(r, c);
  const d = new Date(Date.UTC(f.ano, f.mes - 1, f.dia - 15));
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 };
}
