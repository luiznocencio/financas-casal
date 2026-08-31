import { describe, it, expect } from "vitest";
import { proximoVencimento } from "./vencimento";

describe("proximoVencimento", () => {
  const hoje = { ano: 2026, mes: 8, dia: 31 }; // 31/ago

  it("dia ainda por vir neste mês → vence neste mês, sem atraso", () => {
    const v = proximoVencimento(31, { ano: 2026, mes: 8, dia: 10 }, "2026-08-01", false);
    expect(v).toEqual({ ano: 2026, mes: 8, dia: 31, atrasada: false });
  });

  it("conta cadastrada DEPOIS do vencimento deste mês → é pro mês que vem, sem atraso", () => {
    // dia 10, hoje 31, criada 20/ago (depois do dia 10) → set/10
    const v = proximoVencimento(10, hoje, "2026-08-20", false);
    expect(v).toEqual({ ano: 2026, mes: 9, dia: 10, atrasada: false });
  });

  it("conta antiga não paga com vencimento já passado → atraso de verdade neste mês", () => {
    const v = proximoVencimento(10, hoje, "2026-07-01", false);
    expect(v).toEqual({ ano: 2026, mes: 8, dia: 10, atrasada: true });
  });

  it("já paga não é atraso", () => {
    const v = proximoVencimento(10, hoje, "2026-07-01", true);
    expect(v.atrasada).toBe(false);
  });

  it("dia 31 em mês curto cai no último dia", () => {
    const v = proximoVencimento(31, { ano: 2026, mes: 2, dia: 1 }, "2026-02-01", false);
    expect(v).toEqual({ ano: 2026, mes: 2, dia: 28, atrasada: false });
  });

  it("vira o ano: dezembro → janeiro", () => {
    const v = proximoVencimento(5, { ano: 2026, mes: 12, dia: 20 }, "2026-12-15", false);
    expect(v).toEqual({ ano: 2027, mes: 1, dia: 5, atrasada: false });
  });
});
