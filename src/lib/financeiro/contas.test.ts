import { describe, it, expect } from "vitest";
import { mesRefConta, contaOcorreNoMes, contaVisivelNoMes, type ContaOcorrencia } from "./contas";

const base = (over: Partial<ContaOcorrencia>): ContaOcorrencia => ({
  dia_vencimento: 10, recorrencia: "mensal", data_fim: null, created_at: "2026-08-05", ...over,
});

describe("mesRefConta", () => {
  it("dia ainda por vir no mês de criação → começa no mês de criação", () => {
    expect(mesRefConta("2026-08-05", 10)).toEqual({ ano: 2026, mes: 8 });
  });
  it("dia já passou no mês de criação → começa no mês seguinte", () => {
    expect(mesRefConta("2026-08-20", 10)).toEqual({ ano: 2026, mes: 9 });
  });
  it("vira o ano", () => {
    expect(mesRefConta("2026-12-20", 10)).toEqual({ ano: 2027, mes: 1 });
  });
});

describe("contaOcorreNoMes", () => {
  it("mensal ocorre da 1ª ocorrência em diante", () => {
    const c = base({ created_at: "2026-08-05" });
    expect(contaOcorreNoMes(c, 2026, 7)).toBe(false);
    expect(contaOcorreNoMes(c, 2026, 8)).toBe(true);
    expect(contaOcorreNoMes(c, 2026, 12)).toBe(true);
  });
  it("mensal respeita data_fim", () => {
    const c = base({ created_at: "2026-08-05", data_fim: "2026-10-31" });
    expect(contaOcorreNoMes(c, 2026, 10)).toBe(true);
    expect(contaOcorreNoMes(c, 2026, 11)).toBe(false);
  });
  it("unica só no mês de referência", () => {
    const c = base({ recorrencia: "unica", created_at: "2026-08-05" });
    expect(contaOcorreNoMes(c, 2026, 8)).toBe(true);
    expect(contaOcorreNoMes(c, 2026, 9)).toBe(false);
  });
});

describe("contaVisivelNoMes", () => {
  it("unica some depois de paga (mas aparece no mês em que foi paga)", () => {
    const c = base({ recorrencia: "unica", created_at: "2026-08-20" }); // ref = set
    // set, ainda não paga → aparece
    expect(contaVisivelNoMes(c, 2026, 9, false, false)).toBe(true);
    // out, nunca paga (atrasada) → ainda aparece
    expect(contaVisivelNoMes(c, 2026, 10, false, false)).toBe(true);
    // paga neste mês → aparece (mostra "pago")
    expect(contaVisivelNoMes(c, 2026, 9, true, true)).toBe(true);
    // já paga num mês anterior → some
    expect(contaVisivelNoMes(c, 2026, 10, true, false)).toBe(false);
  });
  it("mensal aparece quando ocorre no mês", () => {
    const c = base({ created_at: "2026-08-05", data_fim: "2026-09-30" });
    expect(contaVisivelNoMes(c, 2026, 9, false, false)).toBe(true);
    expect(contaVisivelNoMes(c, 2026, 10, false, false)).toBe(false); // fora do data_fim
  });
});
