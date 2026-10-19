import { describe, it, expect } from "vitest";
import { corrigirDescricao, inicialMaiuscula } from "./corrigirTexto";

describe("inicialMaiuscula", () => {
  it("sobe só a primeira letra e limpa espaços", () => {
    expect(inicialMaiuscula("  padaria   do zé ")).toBe("Padaria do zé");
    expect(inicialMaiuscula("ágEUA")).toBe("ÁgEUA");
    expect(inicialMaiuscula("")).toBe("");
  });
});

describe("corrigirDescricao", () => {
  it("usa a correção do modelo", async () => {
    const r = await corrigirDescricao("farmacia", async () => '{"texto":"farmácia"}');
    expect(r).toBe("Farmácia");
  });
  it("sem modelo, só a maiúscula", async () => {
    expect(await corrigirDescricao("mercado", null)).toBe("Mercado");
  });
  it("ignora resposta que reescreve demais", async () => {
    const r = await corrigirDescricao("ifood", async () => '{"texto":"Restaurante delivery de comida"}');
    expect(r).toBe("Ifood");
  });
  it("modelo com erro ou JSON inválido fica no original", async () => {
    expect(await corrigirDescricao("uber", async () => { throw new Error("x"); })).toBe("Uber");
    expect(await corrigirDescricao("uber", async () => "nada")).toBe("Uber");
  });
});
