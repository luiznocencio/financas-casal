import { describe, it, expect } from "vitest";
import { lerParcela, baseDescricao, nomeBase, assinaturaParcela, agruparParcelas, mesmaCompra, type TxParcela } from "./parcelas";

describe("lerParcela", () => {
  it("lê k/M válido", () => {
    expect(lerParcela("TENIS NIKE 03/12")).toEqual({ parcela_n: 3, total: 12 });
    expect(lerParcela("Compra 1 / 10")).toEqual({ parcela_n: 1, total: 10 });
  });
  it("lê marcador colado no texto (banco)", () => {
    expect(lerParcela("Pague menos 01602/04")).toEqual({ parcela_n: 2, total: 4 });
    expect(lerParcela("Zp*sena representa03/10")).toEqual({ parcela_n: 3, total: 10 });
    expect(lerParcela("Unidas locadora sa02/03")).toEqual({ parcela_n: 2, total: 3 });
  });
  it("ignora quando não é parcela", () => {
    expect(lerParcela("Mercado")).toBeNull();
    expect(lerParcela("Banana 5/2")).toBeNull(); // n > total
    expect(lerParcela("Item 1/1")).toBeNull(); // total < 2
  });
});

describe("nomeBase", () => {
  it("casa variações do banco pro mesmo nome base", () => {
    expect(nomeBase("PAGUE MENOS 016 01/04")).toBe(nomeBase("Pague menos 01602/04"));
    expect(nomeBase("Amazon - Parcela 2/2")).toBe("amazon");
  });
});

describe("baseDescricao", () => {
  it("remove o marcador de parcela", () => {
    expect(baseDescricao("TENIS NIKE 03/12")).toBe("TENIS NIKE");
    expect(baseDescricao("Sofá  02 / 06  ")).toBe("Sofá");
  });
});

describe("assinaturaParcela", () => {
  it("casa a mesma compra em faturas diferentes (case/acento/parcela)", () => {
    const a = assinaturaParcela("card1", "TENIS NIKE 03/12", 12);
    const b = assinaturaParcela("card1", "tenis nike 04/12", 12);
    expect(a).toBe(b);
  });
  it("difere por cartão e por total", () => {
    expect(assinaturaParcela("card1", "X 1/12", 12)).not.toBe(assinaturaParcela("card2", "X 1/12", 12));
    expect(assinaturaParcela("card1", "X 1/12", 12)).not.toBe(assinaturaParcela("card1", "X 1/10", 10));
  });
});

describe("agruparParcelas", () => {
  const mk = (over: Partial<TxParcela>): TxParcela => ({
    grupo_parcela: null, card_id: "c1", descricao: "TENIS 01/12", valor_centavos: 10000,
    total_parcelas: 12, parcela_n: 1, cartaoNome: "Nubank", ...over,
  });

  it("agrupa por grupo_parcela e calcula quantas faltam", () => {
    const g = "grp-1";
    const txs = [
      mk({ grupo_parcela: g, parcela_n: 1, descricao: "TENIS 01/12" }),
      mk({ grupo_parcela: g, parcela_n: 2, descricao: "TENIS 02/12" }),
      mk({ grupo_parcela: g, parcela_n: 3, descricao: "TENIS 03/12" }),
    ];
    const [compra] = agruparParcelas(txs);
    expect(compra.total).toBe(12);
    expect(compra.ultima).toBe(3);
    expect(compra.faltam).toBe(9);
    expect(compra.quitada).toBe(false);
    expect(compra.descricao).toBe("TENIS");
  });

  it("sem grupo, agrupa pela assinatura (nome+total+cartão)", () => {
    const txs = [
      mk({ grupo_parcela: null, parcela_n: 4, descricao: "SOFA 04/06", total_parcelas: 6 }),
      mk({ grupo_parcela: null, parcela_n: 5, descricao: "sofa 05/06", total_parcelas: 6 }),
    ];
    const compras = agruparParcelas(txs);
    expect(compras).toHaveLength(1);
    expect(compras[0].faltam).toBe(1);
  });

  it("ignora não-parceladas e marca quitada", () => {
    const txs = [
      mk({ grupo_parcela: "g", parcela_n: 2, total_parcelas: 2, descricao: "FONE 02/02" }),
      mk({ grupo_parcela: null, total_parcelas: 1, descricao: "Café" }),
    ];
    const compras = agruparParcelas(txs);
    expect(compras).toHaveLength(1);
    expect(compras[0].quitada).toBe(true);
    expect(compras[0].faltam).toBe(0);
  });

  it("funde grupos distintos da MESMA compra (texto do banco variou)", () => {
    // dois grupo_parcela diferentes, nome base prefixo, mesmo total/valor/cartão
    const txs = [
      mk({ grupo_parcela: "g1", card_id: "c1", descricao: "UNIDAS LOCADORA 01/03", total_parcelas: 3, parcela_n: 1, valor_centavos: 12022, id: "a" }),
      mk({ grupo_parcela: "g2", card_id: "c1", descricao: "Unidas locadora sa02/03", total_parcelas: 3, parcela_n: 2, valor_centavos: 12022, id: "b" }),
    ];
    const compras = agruparParcelas(txs);
    expect(compras).toHaveLength(1);
    expect(compras[0].ultima).toBe(2);
    expect(compras[0].faltam).toBe(1);
    expect(compras[0].txIds.sort()).toEqual(["a", "b"]);
  });

  it("NÃO funde compras diferentes (total/valor distintos)", () => {
    const txs = [
      mk({ grupo_parcela: "g1", card_id: "c1", descricao: "Amazon 2/2", total_parcelas: 2, parcela_n: 2, valor_centavos: 5894 }),
      mk({ grupo_parcela: "g2", card_id: "c1", descricao: "Amazon 3/5", total_parcelas: 5, parcela_n: 3, valor_centavos: 8922 }),
    ];
    expect(agruparParcelas(txs)).toHaveLength(2);
  });
});

describe("mesmaCompra", () => {
  const base = { chave: "", cartaoNome: "x", ultima: 1, faltam: 1, quitada: false, txIds: [] as string[], descricao: "" };
  it("prefixo do nome base, mesmo cartão/total/valor", () => {
    const a = { ...base, cardId: "c1", total: 3, valorParcelaCentavos: 100, nomeBase: "unidas locadora" };
    const b = { ...base, cardId: "c1", total: 3, valorParcelaCentavos: 100, nomeBase: "unidas locadora sa" };
    expect(mesmaCompra(a, b)).toBe(true);
  });
  it("nomes sem prefixo comum não casam", () => {
    const a = { ...base, cardId: "c1", total: 10, valorParcelaCentavos: 40000, nomeBase: "maquineta sena" };
    const b = { ...base, cardId: "c1", total: 10, valorParcelaCentavos: 40000, nomeBase: "zp*sena representa" };
    expect(mesmaCompra(a, b)).toBe(false);
  });
});
