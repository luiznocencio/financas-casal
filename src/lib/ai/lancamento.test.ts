import { describe, it, expect } from "vitest";
import { interpretarLancamento } from "./lancamento";

const ctx = {
  cartoes: [{ id: "card1", nome: "Nubank" }],
  contas: [{ id: "acc1", nome: "Corrente" }],
  categorias: [{ id: "cat1", nome: "Mercado" }],
  membros: ["Luiz", "Ana"],
};

describe("interpretarLancamento", () => {
  it("mapeia a resposta do modelo para IDs existentes", async () => {
    const modeloFake = async () =>
      JSON.stringify({
        tipo: "despesa", valor_reais: 250, descricao: "mercado",
        categoria: "Mercado", origem_nome: "Nubank", origem_tipo: "cartao",
        pessoa: "Luiz", total_parcelas: 1,
      });
    const s = await interpretarLancamento("mercado 250 no crédito do nubank", ctx, modeloFake);
    expect(s.valor_centavos).toBe(25000);
    expect(s.card_id).toBe("card1");
    expect(s.account_id).toBeNull();
    expect(s.categoria_id).toBe("cat1");
    expect(s.pessoa).toBe("Luiz");
  });

  it("cai em receita e conta quando o modelo indicar", async () => {
    const modeloFake = async () =>
      JSON.stringify({
        tipo: "receita", valor_reais: 4200, descricao: "salário",
        categoria: null, origem_nome: "Corrente", origem_tipo: "conta",
        pessoa: "Ana", total_parcelas: 1,
      });
    const s = await interpretarLancamento("salário 4200", ctx, modeloFake);
    expect(s.tipo).toBe("receita");
    expect(s.account_id).toBe("acc1");
    expect(s.card_id).toBeNull();
  });

  it("lança erro quando o modelo retorna JSON inválido", async () => {
    const modeloFake = async () => "não sei";
    await expect(interpretarLancamento("qualquer", ctx, modeloFake)).rejects.toThrow();
  });
});
