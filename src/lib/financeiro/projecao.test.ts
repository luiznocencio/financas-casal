import { describe, it, expect } from "vitest";
import { orcamentoDoMes, estadoCategoria, aCairNoMes, type TxOrc, type FixoOrc, type ContaOrc } from "./projecao";

const tx = (o: Partial<TxOrc>): TxOrc => ({
  tipo: "despesa", valor_centavos: 0, pessoa: "Luiz", categoria_id: null, data_compra: "2026-10-05",
  card_id: null, account_id: "conta", invoice_id: null, total_parcelas: 1, recorrente_id: null,
  conta_pagar_id: null, descricao: "x", ...o,
});
const fixo = (o: Partial<FixoOrc>): FixoOrc => ({
  id: "f1", descricao: "Netflix", valor_centavos: 5000, categoria_id: "lazer", dia: 20,
  card_id: "nubank", account_id: null, data_fim: null, ativo: true, ...o,
});
const conta = (o: Partial<ContaOrc>): ContaOrc => ({
  id: "c1", descricao: "Energia", categoria_id: "casa", valor_estimado_centavos: 20000,
  dia_vencimento: 15, recorrencia: "mensal", data_fim: null, created_at: "2026-01-01T00:00:00Z", ...o,
});
const OUT = { ano: 2026, mes: 10 };

describe("estadoCategoria", () => {
  it("estourou > vai estourar > atenção > ok", () => {
    expect(estadoCategoria(1000, 1200, 0)).toEqual({ estado: "estourou", excesso: 200 });
    expect(estadoCategoria(1000, 800, 300)).toEqual({ estado: "vai_estourar", excesso: 100 });
    expect(estadoCategoria(1000, 900, 0).estado).toBe("atencao");
    expect(estadoCategoria(1000, 500, 100).estado).toBe("ok");
    expect(estadoCategoria(0, 500, 0).estado).toBe("ok"); // sem limite
  });
});

describe("aCairNoMes", () => {
  it("fixo ainda não lançado e conta pendente entram; os já lançados/pagos não", () => {
    const txs = [
      tx({ recorrente_id: "f2", valor_centavos: 3000, card_id: "nubank", account_id: null, descricao: "Spotify" }),
      tx({ conta_pagar_id: "c2", valor_centavos: 9000 }),
    ];
    const itens = aCairNoMes(OUT, {
      txs, invoices: [],
      fixos: [fixo({}), fixo({ id: "f2", descricao: "Spotify", valor_centavos: 3000 })],
      contas: [conta({}), conta({ id: "c2", descricao: "Água" })],
    });
    expect(itens.map((i) => i.descricao).sort()).toEqual(["Energia", "Netflix"]);
  });

  it("fixo encerrado não projeta", () => {
    const itens = aCairNoMes(OUT, { txs: [], invoices: [], fixos: [fixo({ data_fim: "2026-09-30" })], contas: [] });
    expect(itens).toHaveLength(0);
  });

  it("fixo no cartão lançado com data de outro mês mas na fatura deste mês conta como lançado", () => {
    const itens = aCairNoMes(OUT, {
      txs: [tx({ recorrente_id: "f1", data_compra: "2026-09-28", card_id: "nubank", account_id: null, invoice_id: "inv10", valor_centavos: 5000 })],
      invoices: [{ id: "inv10", competencia_ano: 2026, competencia_mes: 10 }],
      fixos: [fixo({})], contas: [],
    });
    expect(itens).toHaveLength(0);
  });
});

describe("orcamentoDoMes", () => {
  it("projeta, faz rollup na mãe e separa o que não tem orçamento", () => {
    const r = orcamentoDoMes(OUT, {
      cats: [{ id: "lazer", parent_id: null }, { id: "streaming", parent_id: "lazer" }, { id: "casa", parent_id: null }, { id: "pets", parent_id: null }],
      budgets: [{ categoria_id: "lazer", valor_centavos: 10000 }, { categoria_id: "casa", valor_centavos: 30000 }],
      txs: [
        tx({ categoria_id: "streaming", valor_centavos: 8000 }),
        tx({ categoria_id: "pets", valor_centavos: 4000 }),
        tx({ categoria_id: null, valor_centavos: 1500 }),
        tx({ categoria_id: "casa", valor_centavos: 2000, data_compra: "2026-09-10" }), // outro mês
      ],
      invoices: [], fixos: [fixo({})], contas: [conta({})],
    });
    const lazer = r.itens.find((i) => i.categoria_id === "lazer")!;
    expect(lazer).toMatchObject({ gasto: 8000, aCair: 5000, projetado: 13000, estado: "vai_estourar", excesso: 3000 });
    const casa = r.itens.find((i) => i.categoria_id === "casa")!;
    expect(casa).toMatchObject({ gasto: 0, aCair: 20000, estado: "ok" });
    expect(r.semOrcamento).toEqual([{ categoria_id: "pets", gasto: 4000 }]);
    expect(r.semCategoria).toBe(1500);
    expect(r.totalGasto).toBe(13500);
    expect(r.totalOrcado).toBe(40000);
    expect(r.totalProjetadoOrcado).toBe(33000);
  });
});
