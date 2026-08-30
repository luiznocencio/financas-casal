// Lógica pura de "quando a fatura fecha", pra decidir os avisos de push.
// dia_fechamento é um dia do mês (1..31); em meses curtos ele "encosta" no
// último dia (ex.: fechamento 31 em fevereiro fecha no dia 28/29).

// Fechamento derivado do vencimento: "fecha N dias antes". Limitado a 1..28 pra
// não estourar em mês curto nem ficar inválido.
export function fechamentoDoVencimento(diaVencimento: number, diasAntes: number): number {
  return Math.min(28, Math.max(1, Math.round(diaVencimento) - Math.round(diasAntes)));
}

export function ultimoDiaDoMes(ano: number, mes: number): number {
  // mes é 1-based; Date.UTC usa mês 0-based, então (ano, mes, 0) = último dia de `mes`.
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** O dia em que a fatura efetivamente fecha em (ano, mes), com clamp de mês curto. */
export function diaDeFechamentoNoMes(diaFechamento: number, ano: number, mes: number): number {
  return Math.min(diaFechamento, ultimoDiaDoMes(ano, mes));
}

/** A fatura (que fecha no dia `diaFechamento`) fecha exatamente na data (ano, mes, dia)? */
export function faturaFechaNaData(
  diaFechamento: number,
  ano: number,
  mes: number,
  dia: number,
): boolean {
  return diaDeFechamentoNoMes(diaFechamento, ano, mes) === dia;
}

/** Partes de calendário (ano/mês/dia) de uma data num fuso, sem depender do fuso do servidor. */
export function partesNoFuso(data: Date, fuso: string): { ano: number; mes: number; dia: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const [ano, mes, dia] = fmt.format(data).split("-").map(Number);
  return { ano, mes, dia };
}

/** O dia seguinte a (ano, mes, dia), rolando mês/ano corretamente. */
export function diaSeguinte(ano: number, mes: number, dia: number): { ano: number; mes: number; dia: number } {
  const d = new Date(Date.UTC(ano, mes - 1, dia + 1));
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
}
