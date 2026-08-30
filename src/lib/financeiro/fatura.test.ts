import { describe, it, expect } from "vitest";
import { competenciaDaCompra, proximaCompetencia } from "./fatura";

describe("competenciaDaCompra", () => {
  const fechamento = 10;
  it("compra antes do fechamento cai no mês corrente", () => {
    expect(competenciaDaCompra(new Date(2026, 2, 5), fechamento)).toEqual({ ano: 2026, mes: 3 });
  });
  it("véspera do fechamento cai no mês corrente", () => {
    expect(competenciaDaCompra(new Date(2026, 2, 9), fechamento)).toEqual({ ano: 2026, mes: 3 });
  });
  it("compra NO dia do fechamento já vai para o mês seguinte", () => {
    expect(competenciaDaCompra(new Date(2026, 2, 10), fechamento)).toEqual({ ano: 2026, mes: 4 });
  });
  it("compra depois do fechamento cai no mês seguinte", () => {
    expect(competenciaDaCompra(new Date(2026, 2, 11), fechamento)).toEqual({ ano: 2026, mes: 4 });
  });
  it("mês curto: fechamento 31 em fevereiro encosta no último dia (28 -> próxima)", () => {
    expect(competenciaDaCompra(new Date(2026, 1, 28), 31)).toEqual({ ano: 2026, mes: 3 });
    expect(competenciaDaCompra(new Date(2026, 1, 27), 31)).toEqual({ ano: 2026, mes: 2 });
  });
  it("virada de ano: dezembro depois do fechamento -> janeiro do ano seguinte", () => {
    expect(competenciaDaCompra(new Date(2026, 11, 20), fechamento)).toEqual({ ano: 2027, mes: 1 });
  });
});

describe("proximaCompetencia", () => {
  it("avança um mês", () => {
    expect(proximaCompetencia({ ano: 2026, mes: 3 })).toEqual({ ano: 2026, mes: 4 });
  });
  it("vira o ano em dezembro", () => {
    expect(proximaCompetencia({ ano: 2026, mes: 12 })).toEqual({ ano: 2027, mes: 1 });
  });
});
