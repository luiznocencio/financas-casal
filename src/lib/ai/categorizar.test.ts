import { describe, it, expect } from "vitest";
import { sugerirCategoria } from "./categorizar";

const cats = [{ id: "c1", nome: "Alimentação" }, { id: "c2", nome: "Transporte" }, { id: "c3", nome: "Mercado" }];

describe("sugerirCategoria", () => {
  it("mapeia ifood para Alimentação", () => {
    expect(sugerirCategoria("iFood almoço", cats)).toBe("c1");
  });
  it("mapeia uber para Transporte", () => {
    expect(sugerirCategoria("Uber centro", cats)).toBe("c2");
  });
  it("retorna null quando não reconhece", () => {
    expect(sugerirCategoria("xyz", cats)).toBeNull();
  });
});
