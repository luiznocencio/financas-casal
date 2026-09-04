import { describe, it, expect } from "vitest";
import { limiteDisponivel, saldoConta } from "./derivados";

describe("limiteDisponivel", () => {
  it("desconta as parcelas em aberto do limite total", () => {
    expect(limiteDisponivel(500000, [{ valor_centavos: 120000 }, { valor_centavos: 30000 }])).toBe(350000);
  });
  it("sem parcelas, limite disponível = limite total", () => {
    expect(limiteDisponivel(500000, [])).toBe(500000);
  });
});

describe("saldoConta", () => {
  it("soma receitas e subtrai despesas a partir do saldo inicial", () => {
    const saldo = saldoConta(100000, [
      { tipo: "receita", valor_centavos: 420000 },
      { tipo: "despesa", valor_centavos: 25000 },
      { tipo: "despesa", valor_centavos: 5000 },
    ]);
    expect(saldo).toBe(490000);
  });
  it("transferência conta como despesa naquela conta", () => {
    expect(saldoConta(10000, [{ tipo: "transferencia", valor_centavos: 4000 }])).toBe(6000);
  });
  it("a perna de entrada da transferência soma no saldo do destino", () => {
    expect(saldoConta(10000, [{ tipo: "transferencia_entrada", valor_centavos: 4000 }])).toBe(14000);
  });
  it("transferência entre contas: sai de uma, entra na outra (soma zero)", () => {
    const origem = saldoConta(10000, [{ tipo: "transferencia", valor_centavos: 4000 }]);
    const destino = saldoConta(0, [{ tipo: "transferencia_entrada", valor_centavos: 4000 }]);
    expect(origem + destino).toBe(10000); // o dinheiro só mudou de lugar
  });
});
