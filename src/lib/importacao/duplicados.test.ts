import { describe, it, expect } from "vitest";
import { marcarDuplicados } from "./duplicados";

const mk = (data: string, valor: number, descricao = "x") => ({
  data, descricao, valor_centavos: valor, tipo: "despesa" as const, total_parcelas: 1,
});

describe("marcarDuplicados", () => {
  it("marca linha que bate valor no mesmo dia", () => {
    const r = marcarDuplicados([mk("2026-03-05", 25000), mk("2026-03-06", 3000)],
      [{ data_compra: "2026-03-05", valor_centavos: 25000 }]);
    expect(r[0].duplicada).toBe(true);
    expect(r[1].duplicada).toBe(false);
  });

  it("sem existentes, nada é duplicado", () => {
    const r = marcarDuplicados([mk("2026-03-05", 25000)], []);
    expect(r.every((l) => !l.duplicada)).toBe(true);
  });

  it("casa dentro da janela de dias (data manual difere da fatura)", () => {
    // lançado à mão dia 03, fatura mostra dia 05 → mesmo valor, 2 dias → duplicado
    const r = marcarDuplicados([mk("2026-03-05", 8990)],
      [{ data_compra: "2026-03-03", valor_centavos: 8990 }]);
    expect(r[0].duplicada).toBe(true);
  });

  it("fora da janela não casa", () => {
    const r = marcarDuplicados([mk("2026-03-20", 8990)],
      [{ data_compra: "2026-03-03", valor_centavos: 8990 }], 4);
    expect(r[0].duplicada).toBe(false);
  });

  it("guloso 1-a-1: 2 iguais na fatura, só 1 já lançado → marca 1", () => {
    const r = marcarDuplicados([mk("2026-03-05", 1000), mk("2026-03-05", 1000)],
      [{ data_compra: "2026-03-05", valor_centavos: 1000 }]);
    const marcados = r.filter((l) => l.duplicada).length;
    expect(marcados).toBe(1);
  });

  it("valores diferentes nunca casam", () => {
    const r = marcarDuplicados([mk("2026-03-05", 1000)],
      [{ data_compra: "2026-03-05", valor_centavos: 1001 }]);
    expect(r[0].duplicada).toBe(false);
  });

  it("receita não casa com despesa de mesmo valor", () => {
    const linhaReceita = { ...mk("2026-03-05", 15000), tipo: "receita" as const };
    const r = marcarDuplicados([linhaReceita],
      [{ data_compra: "2026-03-05", valor_centavos: 15000, tipo: "despesa" }]);
    expect(r[0].duplicada).toBe(false);
  });
});
