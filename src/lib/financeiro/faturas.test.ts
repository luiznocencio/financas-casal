import { describe, it, expect } from "vitest";
import { agruparFaturas } from "./faturas";

const invoices = [
  { id: "inv-abr", competencia_ano: 2026, competencia_mes: 4, status: "aberta" },
  { id: "inv-mar", competencia_ano: 2026, competencia_mes: 3, status: "paga" },
];
const txs = [
  { invoice_id: "inv-mar", valor_centavos: 10000 },
  { invoice_id: "inv-mar", valor_centavos: 5000 },
  { invoice_id: "inv-abr", valor_centavos: 7000 },
  { invoice_id: null, valor_centavos: 999 }, // lançamento em conta, ignorado
];

describe("agruparFaturas", () => {
  it("soma o total de cada fatura a partir das transações", () => {
    const fs = agruparFaturas(invoices, txs);
    const mar = fs.find((f) => f.id === "inv-mar")!;
    const abr = fs.find((f) => f.id === "inv-abr")!;
    expect(mar.totalCentavos).toBe(15000);
    expect(abr.totalCentavos).toBe(7000);
  });

  it("reflete o status pago da fatura", () => {
    const fs = agruparFaturas(invoices, txs);
    expect(fs.find((f) => f.id === "inv-mar")!.paga).toBe(true);
    expect(fs.find((f) => f.id === "inv-abr")!.paga).toBe(false);
  });

  it("ordena por competência crescente (ano, mês)", () => {
    const fs = agruparFaturas(invoices, txs);
    expect(fs.map((f) => f.id)).toEqual(["inv-mar", "inv-abr"]);
  });

  it("não quebra com fatura sem transações (total 0)", () => {
    const fs = agruparFaturas(
      [{ id: "inv-vazia", competencia_ano: 2026, competencia_mes: 5, status: "aberta" }],
      [],
    );
    expect(fs[0].totalCentavos).toBe(0);
  });
});
