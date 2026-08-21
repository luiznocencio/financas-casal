export function limiteDisponivel(
  limiteTotalCentavos: number,
  parcelasEmAberto: { valor_centavos: number }[],
): number {
  const usado = parcelasEmAberto.reduce((s, p) => s + p.valor_centavos, 0);
  return limiteTotalCentavos - usado;
}

export function saldoConta(
  saldoInicialCentavos: number,
  movimentos: { tipo: "despesa" | "receita" | "transferencia"; valor_centavos: number }[],
): number {
  return movimentos.reduce((saldo, m) => {
    if (m.tipo === "receita") return saldo + m.valor_centavos;
    return saldo - m.valor_centavos; // despesa e transferência (saída) reduzem
  }, saldoInicialCentavos);
}
