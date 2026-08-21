import { describe, it, expect } from "vitest";
import { mapearRegistros } from "./registros";
import { planejarLinhas } from "./planejar";

describe("mapearRegistros", () => {
  it("cartão parcelado (3x): cada registro recebe o invoice_id da própria competência", () => {
    const linhas = planejarLinhas({
      tipo: "despesa", valor_centavos: 9000, data_compra: "2026-03-05",
      categoria_id: "cat1", pessoa: "Ana", account_id: null, card_id: "card1",
      total_parcelas: 3, descricao: "tênis",
    }, 10 /* dia_fechamento */);

    // confirma a premissa: 3 competências distintas (mar/abr/mai 2026)
    expect(linhas.map((l) => l.invoiceCompetencia)).toEqual([
      { ano: 2026, mes: 3 },
      { ano: 2026, mes: 4 },
      { ano: 2026, mes: 5 },
    ]);

    const invoiceIdPorComp = new Map<string, string>([
      ["2026-3", "invoice-mar"],
      ["2026-4", "invoice-abr"],
      ["2026-5", "invoice-mai"],
    ]);

    const registros = mapearRegistros(linhas, invoiceIdPorComp, {
      householdId: "hh-1",
      criadoPor: "user-1",
      origemIa: false,
    });

    expect(registros).toHaveLength(3);
    expect(registros[0].invoice_id).toBe("invoice-mar");
    expect(registros[1].invoice_id).toBe("invoice-abr");
    expect(registros[2].invoice_id).toBe("invoice-mai");

    // mesmo grupo_parcela em todas as parcelas
    expect(registros.every((r) => r.grupo_parcela === registros[0].grupo_parcela)).toBe(true);
    expect(registros[0].grupo_parcela).not.toBeNull();

    // soma dos valores bate com o total
    expect(registros.reduce((s, r) => s + r.valor_centavos, 0)).toBe(9000);

    // household_id vem sempre do ctx
    expect(registros.every((r) => r.household_id === "hh-1")).toBe(true);
  });

  it("lançamento em conta: invoice_id e card_id nulos", () => {
    const linhas = planejarLinhas({
      tipo: "despesa", valor_centavos: 5000, data_compra: "2026-03-05",
      categoria_id: null, pessoa: "Luiz", account_id: "acc1", card_id: null,
      total_parcelas: 1, descricao: "café",
    }, null);

    const invoiceIdPorComp = new Map<string, string>();

    const registros = mapearRegistros(linhas, invoiceIdPorComp, {
      householdId: "hh-1",
      criadoPor: "user-1",
      origemIa: false,
    });

    expect(registros).toHaveLength(1);
    expect(registros[0].invoice_id).toBeNull();
    expect(registros[0].card_id).toBeNull();
    expect(registros[0].account_id).toBe("acc1");
  });

  it("isolamento: household_id e criado_por vêm sempre do ctx, nunca das linhas", () => {
    const linhas = planejarLinhas({
      tipo: "despesa", valor_centavos: 12000, data_compra: "2026-06-15",
      categoria_id: "cat2", pessoa: "Bia", account_id: null, card_id: "card2",
      total_parcelas: 2, descricao: "presente",
    }, 20);

    // household_id/criado_por não existem em LinhaPlanejada — mesmo assim,
    // garantimos que o resultado nunca reflita nada além do ctx informado.
    const invoiceIdPorComp = new Map<string, string>([
      ["2026-6", "invoice-jun"],
      ["2026-7", "invoice-jul"],
    ]);

    const registros = mapearRegistros(linhas, invoiceIdPorComp, {
      householdId: "hh-isolado",
      criadoPor: "user-isolado",
      origemIa: true,
    });

    expect(registros.every((r) => r.household_id === "hh-isolado")).toBe(true);
    expect(registros.every((r) => r.criado_por === "user-isolado")).toBe(true);
    expect(registros.every((r) => r.origem_ia === true)).toBe(true);
  });
});
