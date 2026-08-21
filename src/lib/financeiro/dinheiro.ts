export function reaisParaCentavos(entrada: string | number): number {
  if (typeof entrada === "number") return Math.round(entrada * 100);
  const limpo = entrada.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const v = parseFloat(limpo);
  return Number.isNaN(v) ? 0 : Math.round(v * 100);
}

export function centavosParaReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
