import { describe, it, expect } from "vitest";
import { indexarRegras, regraEfetiva, type Regra } from "./regras";

const r = (over: Partial<Regra>): Regra => ({ chave: "totalpass", card_id: null, categoria_id: null, descricao_preferida: null, ...over });

describe("regraEfetiva", () => {
  const regras = indexarRegras([
    r({ card_id: null, categoria_id: "saude", descricao_preferida: "Totalpass" }),
    r({ card_id: "nubank-aninha", descricao_preferida: "Totalpass Luiz" }),
    r({ card_id: "itau-luiz", descricao_preferida: "Totalpass Ana" }),
  ]);

  it("mesmo texto do banco, nome diferente por cartão", () => {
    expect(regraEfetiva(regras, "totalpass", "nubank-aninha")?.descricao_preferida).toBe("Totalpass Luiz");
    expect(regraEfetiva(regras, "totalpass", "itau-luiz")?.descricao_preferida).toBe("Totalpass Ana");
  });

  it("o que faltar na regra do cartão vem da casa (categoria)", () => {
    expect(regraEfetiva(regras, "totalpass", "nubank-aninha")?.categoria_id).toBe("saude");
  });

  it("cartão sem regra própria e conta/pix usam a da casa", () => {
    expect(regraEfetiva(regras, "totalpass", "inter-luiz")?.descricao_preferida).toBe("Totalpass");
    expect(regraEfetiva(regras, "totalpass", null)?.descricao_preferida).toBe("Totalpass");
  });

  it("sem nenhuma regra devolve null", () => {
    expect(regraEfetiva(regras, "netflix", "itau-luiz")).toBeNull();
  });
});
