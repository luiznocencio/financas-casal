import { describe, it, expect } from "vitest";
import { agruparFaturas, faturaAtualDoCartao, faturasEmAbertoAteAtual } from "./faturas";

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

describe("estorno na fatura", () => {
  it("receita (estorno/crédito) abate o total da fatura", () => {
    const fs = agruparFaturas(
      [{ id: "f", competencia_ano: 2026, competencia_mes: 10, status: "aberta" }],
      [
        { invoice_id: "f", valor_centavos: 10000, tipo: "despesa" },
        { invoice_id: "f", valor_centavos: 2500, tipo: "receita" },
      ],
    );
    expect(fs[0].totalCentavos).toBe(7500);
  });
});

describe("fatura atual em aberto", () => {
  it("compra de hoje cai na fatura do mês do vencimento", () => {
    const nubank = { dia_fechamento: 30, dia_vencimento: 7 };
    expect(faturaAtualDoCartao(nubank, { ano: 2026, mes: 10, dia: 9 })).toEqual({ ano: 2026, mes: 11 });
    const itau = { dia_fechamento: 4, dia_vencimento: 10 };
    expect(faturaAtualDoCartao(itau, { ano: 2026, mes: 10, dia: 9 })).toEqual({ ano: 2026, mes: 11 });
    expect(faturaAtualDoCartao(itau, { ano: 2026, mes: 10, dia: 2 })).toEqual({ ano: 2026, mes: 10 });
  });

  it("conta as não pagas até a atual; paga e futuras (parcelas) ficam de fora", () => {
    const invs = [
      { id: "set", competencia_ano: 2026, competencia_mes: 9, status: "aberta" },
      { id: "out", competencia_ano: 2026, competencia_mes: 10, status: "paga" },
      { id: "nov", competencia_ano: 2026, competencia_mes: 11, status: "aberta" },
      { id: "dez", competencia_ano: 2026, competencia_mes: 12, status: "aberta" },
    ];
    expect(faturasEmAbertoAteAtual(invs, { ano: 2026, mes: 11 }).map((i) => i.id)).toEqual(["set", "nov"]);
  });
});
