import { describe, it, expect } from "vitest";
import { casaDescricao, recorrenteJaLancado, type TxExistente } from "./recorrentes";

describe("casaDescricao", () => {
  it("tolera variações (contém)", () => {
    expect(casaDescricao("Netflix", "NETFLIX.COM")).toBe(true);
    expect(casaDescricao("Spotify", "spotify")).toBe(true);
    expect(casaDescricao("Netflix", "Disney")).toBe(false);
    expect(casaDescricao("", "x")).toBe(false);
  });
});

describe("recorrenteJaLancado", () => {
  const fixoCartao = { id: "r1", descricao: "Netflix", valor_centavos: 5590, card_id: "c1", account_id: null };

  it("pega pelo vínculo direto (recorrente_id)", () => {
    const ex: TxExistente[] = [{ recorrente_id: "r1", descricao: "qualquer", valor_centavos: 0, card_id: null, account_id: null }];
    expect(recorrenteJaLancado(fixoCartao, ex)).toBe(true);
  });
  it("pega a compra importada do cartão (valor + cartão + descrição parecida)", () => {
    const ex: TxExistente[] = [{ recorrente_id: null, descricao: "NETFLIX.COM", valor_centavos: 5590, card_id: "c1", account_id: null }];
    expect(recorrenteJaLancado(fixoCartao, ex)).toBe(true);
  });
  it("não casa se o valor difere", () => {
    const ex: TxExistente[] = [{ recorrente_id: null, descricao: "NETFLIX.COM", valor_centavos: 5000, card_id: "c1", account_id: null }];
    expect(recorrenteJaLancado(fixoCartao, ex)).toBe(false);
  });
  it("não casa se for outro cartão", () => {
    const ex: TxExistente[] = [{ recorrente_id: null, descricao: "Netflix", valor_centavos: 5590, card_id: "c2", account_id: null }];
    expect(recorrenteJaLancado(fixoCartao, ex)).toBe(false);
  });
});
