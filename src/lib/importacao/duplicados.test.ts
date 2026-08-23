import { describe, it, expect } from "vitest";
import { marcarDuplicados } from "./duplicados";

const linhas = [
  { data: "2026-03-05", descricao: "Mercado", valor_centavos: 25000, tipo: "despesa" as const, total_parcelas: 1 },
  { data: "2026-03-06", descricao: "Uber", valor_centavos: 3000, tipo: "despesa" as const, total_parcelas: 1 },
];

describe("marcarDuplicados", () => {
  it("marca linha que bate data+valor com um existente", () => {
    const r = marcarDuplicados(linhas, [{ data_compra: "2026-03-05", valor_centavos: 25000 }]);
    expect(r[0].duplicada).toBe(true);
    expect(r[1].duplicada).toBe(false);
  });
  it("sem existentes, nada é duplicado", () => {
    const r = marcarDuplicados(linhas, []);
    expect(r.every((l) => !l.duplicada)).toBe(true);
  });
});
