import { describe, it, expect } from "vitest";
import { gerarParcelas } from "./parcelas";

describe("gerarParcelas", () => {
  it("compra à vista gera 1 parcela na competência da compra", () => {
    const ps = gerarParcelas({ valorTotalCentavos: 5000, totalParcelas: 1, dataCompra: new Date(2026, 2, 5), diaFechamento: 10 });
    expect(ps).toHaveLength(1);
    expect(ps[0]).toEqual({ parcela_n: 1, total_parcelas: 1, valor_centavos: 5000, competencia: { ano: 2026, mes: 3 } });
  });

  it("distribui 12x nos 12 meses seguintes a partir da competência", () => {
    const ps = gerarParcelas({ valorTotalCentavos: 120000, totalParcelas: 12, dataCompra: new Date(2026, 2, 5), diaFechamento: 10 });
    expect(ps).toHaveLength(12);
    expect(ps[0].competencia).toEqual({ ano: 2026, mes: 3 });
    expect(ps[11].competencia).toEqual({ ano: 2027, mes: 2 });
    expect(ps.reduce((s, p) => s + p.valor_centavos, 0)).toBe(120000);
  });

  it("coloca o resto do rateio na primeira parcela", () => {
    const ps = gerarParcelas({ valorTotalCentavos: 10000, totalParcelas: 3, dataCompra: new Date(2026, 2, 5), diaFechamento: 10 });
    expect(ps.map((p) => p.valor_centavos)).toEqual([3334, 3333, 3333]);
    expect(ps.reduce((s, p) => s + p.valor_centavos, 0)).toBe(10000);
  });

  it("compra depois do fechamento começa no mês seguinte", () => {
    const ps = gerarParcelas({ valorTotalCentavos: 6000, totalParcelas: 2, dataCompra: new Date(2026, 2, 20), diaFechamento: 10 });
    expect(ps[0].competencia).toEqual({ ano: 2026, mes: 4 });
    expect(ps[1].competencia).toEqual({ ano: 2026, mes: 5 });
  });
});
