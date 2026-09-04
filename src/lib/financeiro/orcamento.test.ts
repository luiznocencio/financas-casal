import { describe, it, expect } from "vitest";
import { resumoOrcamento } from "./orcamento";

describe("resumoOrcamento (em reais)", () => {
  const params = {
    rendaCentavos: 1000000,
    budgets: [
      { categoria_id: "mercado", valor_centavos: 150000 },
      { categoria_id: "lazer", valor_centavos: 100000 },
    ],
    gastoPorCategoria: { mercado: 120000, lazer: 130000 },
  };

  it("calcula limite, gasto, restante e pctUsado por categoria", () => {
    const r = resumoOrcamento(params);
    const mercado = r.itens.find((i) => i.categoria_id === "mercado")!;
    expect(mercado.limiteCentavos).toBe(150000);
    expect(mercado.gastoCentavos).toBe(120000);
    expect(mercado.restanteCentavos).toBe(30000);
    expect(mercado.pctUsado).toBeCloseTo(80, 5);
    const lazer = r.itens.find((i) => i.categoria_id === "lazer")!;
    expect(lazer.restanteCentavos).toBe(-30000); // estourou (130k > 100k)
    expect(lazer.pctUsado).toBeCloseTo(130, 5);
  });

  it("totais e reserva (renda − orçado)", () => {
    const r = resumoOrcamento(params);
    expect(r.totalOrcadoCentavos).toBe(250000);
    expect(r.totalGastoCentavos).toBe(250000);
    expect(r.reservaCentavos).toBe(750000);
  });

  it("orçar acima da renda deixa a reserva negativa", () => {
    const r = resumoOrcamento({
      rendaCentavos: 100000,
      budgets: [{ categoria_id: "x", valor_centavos: 150000 }],
      gastoPorCategoria: {},
    });
    expect(r.totalOrcadoCentavos).toBe(150000);
    expect(r.reservaCentavos).toBe(-50000);
  });

  it("pctUsado é 0 quando limite é 0 (evita divisão por zero)", () => {
    const r = resumoOrcamento({ rendaCentavos: 0, budgets: [{ categoria_id: "x", valor_centavos: 0 }], gastoPorCategoria: { x: 5000 } });
    expect(r.itens[0].limiteCentavos).toBe(0);
    expect(r.itens[0].pctUsado).toBe(0);
  });
});
