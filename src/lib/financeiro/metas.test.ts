import { describe, it, expect } from "vitest";
import { calcularMeta, totaisMetas } from "./metas";

describe("calcularMeta", () => {
  it("soma os aportes como guardado; restante = alvo - guardado", () => {
    const m = calcularMeta(500000, [{ valor_centavos: 100000 }, { valor_centavos: 50000 }]);
    expect(m.guardadoCentavos).toBe(150000);
    expect(m.restanteCentavos).toBe(350000);
    expect(m.pctConcluido).toBeCloseTo(30, 5);
    expect(m.concluida).toBe(false);
  });
  it("aporte negativo (retirada) reduz o guardado", () => {
    const m = calcularMeta(500000, [{ valor_centavos: 100000 }, { valor_centavos: -30000 }]);
    expect(m.guardadoCentavos).toBe(70000);
  });
  it("meta atingida: pct limitado a 100 e concluida true", () => {
    const m = calcularMeta(100000, [{ valor_centavos: 120000 }]);
    expect(m.pctConcluido).toBe(100);
    expect(m.restanteCentavos).toBe(0);
    expect(m.concluida).toBe(true);
  });
  it("sem aportes: guardado 0, pct 0", () => {
    const m = calcularMeta(100000, []);
    expect(m.guardadoCentavos).toBe(0);
    expect(m.pctConcluido).toBe(0);
  });
});

describe("totaisMetas", () => {
  it("soma alvos e guardados de todas as metas", () => {
    const goals = [{ id: "g1", valor_alvo_centavos: 500000 }, { id: "g2", valor_alvo_centavos: 200000 }];
    const aportesPorGoal = { g1: [{ valor_centavos: 100000 }], g2: [{ valor_centavos: 200000 }] };
    const t = totaisMetas(goals, aportesPorGoal);
    expect(t.totalAlvoCentavos).toBe(700000);
    expect(t.totalGuardadoCentavos).toBe(300000);
  });
});
