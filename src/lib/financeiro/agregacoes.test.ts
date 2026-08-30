import { describe, it, expect } from "vitest";
import { resumoDoMes } from "./agregacoes";

const txs = [
  { tipo: "despesa", valor_centavos: 10000, pessoa: "Luiz", categoria_id: "c1", data_compra: "2026-03-02" },
  { tipo: "despesa", valor_centavos: 5000, pessoa: "Ana", categoria_id: "c1", data_compra: "2026-03-10" },
  { tipo: "receita", valor_centavos: 400000, pessoa: "Luiz", categoria_id: null, data_compra: "2026-03-05" },
  { tipo: "despesa", valor_centavos: 9999, pessoa: "Ana", categoria_id: "c2", data_compra: "2026-02-15" },
] as const;

describe("resumoDoMes", () => {
  it("soma despesas/receitas do mês de referência", () => {
    const r = resumoDoMes([...txs], { ano: 2026, mes: 3 });
    expect(r.totalDespesas).toBe(15000);
    expect(r.totalReceitas).toBe(400000);
  });
  it("agrupa por pessoa (só despesas)", () => {
    const r = resumoDoMes([...txs], { ano: 2026, mes: 3 });
    expect(r.porPessoa).toEqual({ Luiz: 10000, Ana: 5000 });
  });
  it("agrupa por categoria (só despesas)", () => {
    const r = resumoDoMes([...txs], { ano: 2026, mes: 3 });
    expect(r.porCategoria).toEqual({ c1: 15000 });
  });
  it("compra no cartão conta no mês da fatura (competência), não da data", () => {
    // compra 28/02 mas a fatura fechou → competência março
    const t = [{ tipo: "despesa" as const, valor_centavos: 5000, pessoa: "Luiz", categoria_id: "c1", data_compra: "2026-02-28", competencia: { ano: 2026, mes: 3 } }];
    expect(resumoDoMes(t, { ano: 2026, mes: 3 }).totalDespesas).toBe(5000);
    expect(resumoDoMes(t, { ano: 2026, mes: 2 }).totalDespesas).toBe(0);
  });
});
