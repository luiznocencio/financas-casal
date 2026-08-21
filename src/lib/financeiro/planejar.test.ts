import { describe, it, expect } from "vitest";
import { planejarLinhas } from "./planejar";

describe("planejarLinhas", () => {
  it("lançamento em conta gera 1 linha sem parcelamento", () => {
    const linhas = planejarLinhas({
      tipo: "despesa", valor_centavos: 5000, data_compra: "2026-03-05",
      categoria_id: null, pessoa: "Luiz", account_id: "acc1", card_id: null,
      total_parcelas: 1, descricao: "café",
    }, null);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].account_id).toBe("acc1");
    expect(linhas[0].invoiceCompetencia).toBeNull();
  });

  it("lançamento em cartão 3x gera 3 linhas com competências e grupo_parcela", () => {
    const linhas = planejarLinhas({
      tipo: "despesa", valor_centavos: 9000, data_compra: "2026-03-05",
      categoria_id: null, pessoa: "Ana", account_id: null, card_id: "card1",
      total_parcelas: 3, descricao: "tênis",
    }, 10 /* dia_fechamento */);
    expect(linhas).toHaveLength(3);
    expect(linhas.every((l) => l.grupo_parcela === linhas[0].grupo_parcela)).toBe(true);
    expect(linhas[0].invoiceCompetencia).toEqual({ ano: 2026, mes: 3 });
    expect(linhas[2].invoiceCompetencia).toEqual({ ano: 2026, mes: 5 });
    expect(linhas.reduce((s, l) => s + l.valor_centavos, 0)).toBe(9000);
  });
});
