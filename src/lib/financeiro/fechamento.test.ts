import { describe, it, expect } from "vitest";
import {
  ultimoDiaDoMes, diaDeFechamentoNoMes, faturaFechaNaData, diaSeguinte, partesNoFuso,
} from "./fechamento";

describe("ultimoDiaDoMes", () => {
  it("meses de 31, 30 e fevereiro (comum e bissexto)", () => {
    expect(ultimoDiaDoMes(2026, 1)).toBe(31);
    expect(ultimoDiaDoMes(2026, 4)).toBe(30);
    expect(ultimoDiaDoMes(2026, 2)).toBe(28);
    expect(ultimoDiaDoMes(2024, 2)).toBe(29);
  });
});

describe("diaDeFechamentoNoMes", () => {
  it("mantém o dia quando cabe no mês", () => {
    expect(diaDeFechamentoNoMes(10, 2026, 3)).toBe(10);
  });
  it("encosta no último dia em mês curto", () => {
    expect(diaDeFechamentoNoMes(31, 2026, 2)).toBe(28); // fev comum
    expect(diaDeFechamentoNoMes(31, 2024, 2)).toBe(29); // fev bissexto
    expect(diaDeFechamentoNoMes(31, 2026, 4)).toBe(30); // abril
  });
});

describe("faturaFechaNaData", () => {
  it("bate no dia exato", () => {
    expect(faturaFechaNaData(15, 2026, 8, 15)).toBe(true);
    expect(faturaFechaNaData(15, 2026, 8, 14)).toBe(false);
    expect(faturaFechaNaData(15, 2026, 8, 16)).toBe(false);
  });
  it("cartão que fecha 31 é avisado no último dia do mês curto", () => {
    expect(faturaFechaNaData(31, 2026, 2, 28)).toBe(true);
    expect(faturaFechaNaData(31, 2026, 2, 27)).toBe(false);
  });
});

describe("diaSeguinte", () => {
  it("rola dia, mês e ano", () => {
    expect(diaSeguinte(2026, 8, 10)).toEqual({ ano: 2026, mes: 8, dia: 11 });
    expect(diaSeguinte(2026, 8, 31)).toEqual({ ano: 2026, mes: 9, dia: 1 });
    expect(diaSeguinte(2026, 12, 31)).toEqual({ ano: 2027, mes: 1, dia: 1 });
    expect(diaSeguinte(2024, 2, 28)).toEqual({ ano: 2024, mes: 2, dia: 29 });
  });
});

describe("partesNoFuso", () => {
  it("converte um instante UTC pro calendário de São Paulo", () => {
    // 2026-08-29T01:00Z = 2026-08-28 22:00 em São Paulo (UTC-3)
    expect(partesNoFuso(new Date("2026-08-29T01:00:00Z"), "America/Sao_Paulo"))
      .toEqual({ ano: 2026, mes: 8, dia: 28 });
  });
});
