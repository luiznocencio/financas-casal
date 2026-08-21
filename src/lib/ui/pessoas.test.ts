import { describe, it, expect } from "vitest";
import { corDaPessoa } from "./pessoas";

const membros = ["Luiz", "Ana"];
describe("corDaPessoa", () => {
  it("1º membro → pessoa-a, 2º → pessoa-b", () => {
    expect(corDaPessoa("Luiz", membros)).toBe("var(--pessoa-a)");
    expect(corDaPessoa("Ana", membros)).toBe("var(--pessoa-b)");
  });
  it("conjunto ou desconhecido → cor de conjunto", () => {
    expect(corDaPessoa("conjunto", membros)).toBe("var(--pessoa-conjunto)");
    expect(corDaPessoa("Fulano", membros)).toBe("var(--pessoa-conjunto)");
  });
});
