import { describe, it, expect } from "vitest";
import { normalizeDescricao } from "./descricao";

describe("normalizeDescricao", () => {
  it("minúsculas, trim e colapsa espaços", () => {
    expect(normalizeDescricao("  NETFLIX ")).toBe("netflix");
    expect(normalizeDescricao("IFOOD  *  Restaurante")).toBe("ifood * restaurante");
    expect(normalizeDescricao("Mercado\tLivre")).toBe("mercado livre");
  });
  it("lida com vazio/undefined", () => {
    expect(normalizeDescricao("")).toBe("");
    // @ts-expect-error teste de robustez
    expect(normalizeDescricao(undefined)).toBe("");
  });
});
