import { describe, it, expect } from "vitest";
import { fraseFixa, fraseConfere, type FatosResumo } from "./resumoFrase";

const f: FatosResumo = {
  mes: "outubro", momento: "atual", recebo: "R$ 9.000,00", gasto: "R$ 6.200,00",
  resultadoPositivo: true, resultado: "R$ 2.800,00", estado: "ok", livre: "R$ 1.500,00",
  gastoMesAnterior: "R$ 7.000,00", gastoSubiu: false,
  maiores: [{ nome: "Mercado", valor: "R$ 1.800,00" }],
  estouradas: [], vaoPassar: [{ nome: "Lazer", excesso: "R$ 120,00" }],
};

describe("fraseFixa", () => {
  it("monta o resumo só com os fatos", () => {
    const t = fraseFixa(f);
    expect(t).toContain("R$ 1.500,00 livres");
    expect(t).toContain("Mercado");
    expect(t).toContain("Lazer vai passar R$ 120,00");
    expect(fraseConfere(t, f)).toBe(true);
  });
});

describe("fraseConfere", () => {
  it("aceita valores que estão nos fatos", () => {
    expect(fraseConfere("Vocês têm R$ 1.500,00 livres; Lazer vai passar R$120,00.", f)).toBe(true);
  });
  it("recusa valor inventado (com ou sem R$)", () => {
    expect(fraseConfere("Sobram R$ 1.499,00 livres.", f)).toBe(false);
    expect(fraseConfere("Sobram 3.300,00 no mês.", f)).toBe(false);
  });
  it("recusa vazio ou longo demais", () => {
    expect(fraseConfere("", f)).toBe(false);
    expect(fraseConfere("a".repeat(400), f)).toBe(false);
  });
});
