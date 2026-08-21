export function reaisParaCentavos(entrada: string | number): number {
  if (typeof entrada === "number") return Math.round(entrada * 100);
  const semSimbolos = entrada.replace(/[^\d,.-]/g, "");

  let normalizado: string;
  if (semSimbolos.includes(",")) {
    // Vírgula presente: formato brasileiro. Vírgula é decimal, pontos são milhar.
    normalizado = semSimbolos.replace(/\./g, "").replace(",", ".");
  } else {
    const pontos = semSimbolos.split(".").length - 1;
    const parteDecimal = semSimbolos.includes(".") ? semSimbolos.slice(semSimbolos.lastIndexOf(".") + 1) : "";
    const pontoEhDecimal = pontos === 1 && parteDecimal.length >= 1 && parteDecimal.length <= 2;
    normalizado = pontoEhDecimal ? semSimbolos : semSimbolos.replace(/\./g, "");
  }

  const v = parseFloat(normalizado);
  return Number.isNaN(v) ? 0 : Math.round(v * 100);
}

export function centavosParaReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
