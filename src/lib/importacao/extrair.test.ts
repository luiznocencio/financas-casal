import { describe, it, expect } from "vitest";
import { interpretarImportacao } from "./extrair";

describe("interpretarImportacao", () => {
  it("mapeia os lançamentos do JSON do modelo para centavos", async () => {
    const modeloFake = async () => JSON.stringify({
      lancamentos: [
        { data: "2026-03-05", descricao: "Mercado X", valor_reais: 250.5, tipo: "despesa", total_parcelas: 1 },
        { data: "2026-03-06", descricao: "Tênis 3x", valor_reais: 300, tipo: "despesa", total_parcelas: 3 },
        { data: "2026-03-10", descricao: "Salário", valor_reais: 4200, tipo: "receita", total_parcelas: 1 },
      ],
    });
    const linhas = await interpretarImportacao("qualquer texto", modeloFake);
    expect(linhas).toHaveLength(3);
    expect(linhas[0]).toEqual({ data: "2026-03-05", descricao: "Mercado X", valor_centavos: 25050, tipo: "despesa", total_parcelas: 1 });
    expect(linhas[1].total_parcelas).toBe(3);
    expect(linhas[2].tipo).toBe("receita");
  });

  it("ignora linhas sem valor ou data válidos", async () => {
    const modeloFake = async () => JSON.stringify({
      lancamentos: [
        { data: "2026-03-05", descricao: "ok", valor_reais: 10, tipo: "despesa", total_parcelas: 1 },
        { data: "", descricao: "sem data", valor_reais: 10, tipo: "despesa", total_parcelas: 1 },
        { data: "2026-03-06", descricao: "sem valor", valor_reais: 0, tipo: "despesa", total_parcelas: 1 },
      ],
    });
    const linhas = await interpretarImportacao("x", modeloFake);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].descricao).toBe("ok");
  });

  it("lança erro quando o modelo devolve JSON inválido", async () => {
    await expect(interpretarImportacao("x", async () => "nao é json")).rejects.toThrow();
  });
});
