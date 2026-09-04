export function limiteDisponivel(
  limiteTotalCentavos: number,
  parcelasEmAberto: { valor_centavos: number }[],
): number {
  const usado = parcelasEmAberto.reduce((s, p) => s + p.valor_centavos, 0);
  return limiteTotalCentavos - usado;
}

export function saldoConta(
  saldoInicialCentavos: number,
  movimentos: { tipo: "despesa" | "receita" | "transferencia" | "transferencia_entrada"; valor_centavos: number }[],
): number {
  return movimentos.reduce((saldo, m) => {
    // entradas: receita e a perna de entrada de uma transferência
    if (m.tipo === "receita" || m.tipo === "transferencia_entrada") return saldo + m.valor_centavos;
    return saldo - m.valor_centavos; // despesa e transferência (saída) reduzem
  }, saldoInicialCentavos);
}
