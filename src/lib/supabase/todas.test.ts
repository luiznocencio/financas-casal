import { describe, it, expect } from "vitest";
import { todas } from "./todas";

const fonte = (n: number) => Array.from({ length: n }, (_, i) => i);
const paginador = (dados: number[]) => {
  const chamadas: [number, number][] = [];
  const fn = async (de: number, ate: number) => { chamadas.push([de, ate]); return { data: dados.slice(de, ate + 1), error: null }; };
  return { fn, chamadas };
};

describe("todas", () => {
  it("junta várias páginas até a última incompleta", async () => {
    const { fn, chamadas } = paginador(fonte(25));
    const r = await todas(fn, 10);
    expect(r.data).toEqual(fonte(25));
    expect(chamadas).toEqual([[0, 9], [10, 19], [20, 29]]);
  });

  it("múltiplo exato do lote: busca uma página vazia e para", async () => {
    const { fn, chamadas } = paginador(fonte(20));
    const r = await todas(fn, 10);
    expect(r.data).toHaveLength(20);
    expect(chamadas).toHaveLength(3);
  });

  it("erro em qualquer página: devolve o erro, sem dado parcial", async () => {
    let n = 0;
    const r = await todas(async () => (n++ === 0 ? { data: fonte(10), error: null } : { data: null, error: { message: "boom" } }), 10);
    expect(r.error?.message).toBe("boom");
    expect(r.data).toEqual([]);
  });
});
