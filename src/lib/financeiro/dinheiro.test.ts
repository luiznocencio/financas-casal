import { describe, it, expect } from "vitest";
import { reaisParaCentavos, centavosParaReais } from "./dinheiro";

describe("reaisParaCentavos", () => {
  it("converte número em reais para centavos inteiros", () => {
    expect(reaisParaCentavos(12.34)).toBe(1234);
    expect(reaisParaCentavos(250)).toBe(25000);
  });
  it("aceita string com vírgula e milhar", () => {
    expect(reaisParaCentavos("1.234,56")).toBe(123456);
    expect(reaisParaCentavos("R$ 50,00")).toBe(5000);
  });
  it("não perde centavo por arredondamento", () => {
    expect(reaisParaCentavos(0.1 + 0.2)).toBe(30);
  });
});

describe("centavosParaReais", () => {
  it("formata centavos como moeda BRL", () => {
    expect(centavosParaReais(123456)).toBe("R$ 1.234,56");
    expect(centavosParaReais(0)).toBe("R$ 0,00");
  });
});
