import { describe, it, expect } from "vitest";
import { limiteCategoria, resumoOrcamento } from "./orcamento";

describe("limiteCategoria", () => {
  it("limite = % da renda, arredondado em centavos", () => {
    expect(limiteCategoria(1000000, 15)).toBe(150000); // 15% de R$10.000 = R$1.500
    expect(limiteCategoria(1000000, 0)).toBe(0);
    expect(limiteCategoria(333300, 33.33)).toBe(111089); // round(333300*0.3333)
  });
});

describe("resumoOrcamento", () => {
  const params = {
    rendaCentavos: 1000000,
    budgets: [
      { categoria_id: "mercado", percentual: 15 },
      { categoria_id: "lazer", percentual: 10 },
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

  it("totais e alocação", () => {
    const r = resumoOrcamento(params);
    expect(r.totalPercentual).toBe(25);
    expect(r.totalOrcadoCentavos).toBe(250000);
    expect(r.totalGastoCentavos).toBe(250000);
    expect(r.naoAlocadoPercentual).toBe(75);
    expect(r.reservaCentavos).toBe(750000); // renda - orçado
  });

  it("categoria sem gasto conta como 0; não-alocado nunca negativo", () => {
    const r = resumoOrcamento({
      rendaCentavos: 1000000,
      budgets: [{ categoria_id: "x", percentual: 120 as number }], // acima de 100 no total
      gastoPorCategoria: {},
    });
    expect(r.itens[0].gastoCentavos).toBe(0);
    expect(r.naoAlocadoPercentual).toBe(0); // max(0, 100-120)
  });

  it("pctUsado é 0 quando limite é 0 (evita divisão por zero)", () => {
    const r = resumoOrcamento({ rendaCentavos: 0, budgets: [{ categoria_id: "x", percentual: 10 }], gastoPorCategoria: { x: 5000 } });
    expect(r.itens[0].limiteCentavos).toBe(0);
    expect(r.itens[0].pctUsado).toBe(0);
  });
});
