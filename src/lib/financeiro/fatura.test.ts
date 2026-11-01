import { describe, it, expect } from "vitest";
import { competenciaDaCompra, competenciaDePagamento, proximaCompetencia, fechamentoDaFatura, faturaDaCompra, faturaFechaNoDia, mesDaFatura } from "./fatura";

describe("competenciaDaCompra", () => {
  const fechamento = 10;
  it("compra antes do fechamento cai no mês corrente", () => {
    expect(competenciaDaCompra(new Date(2026, 2, 5), fechamento)).toEqual({ ano: 2026, mes: 3 });
  });
  it("véspera do fechamento cai no mês corrente", () => {
    expect(competenciaDaCompra(new Date(2026, 2, 9), fechamento)).toEqual({ ano: 2026, mes: 3 });
  });
  it("compra NO dia do fechamento já vai para o mês seguinte", () => {
    expect(competenciaDaCompra(new Date(2026, 2, 10), fechamento)).toEqual({ ano: 2026, mes: 4 });
  });
  it("compra depois do fechamento cai no mês seguinte", () => {
    expect(competenciaDaCompra(new Date(2026, 2, 11), fechamento)).toEqual({ ano: 2026, mes: 4 });
  });
  it("mês curto: fechamento 31 em fevereiro encosta no último dia (28 -> próxima)", () => {
    expect(competenciaDaCompra(new Date(2026, 1, 28), 31)).toEqual({ ano: 2026, mes: 3 });
    expect(competenciaDaCompra(new Date(2026, 1, 27), 31)).toEqual({ ano: 2026, mes: 2 });
  });
  it("virada de ano: dezembro depois do fechamento -> janeiro do ano seguinte", () => {
    expect(competenciaDaCompra(new Date(2026, 11, 20), fechamento)).toEqual({ ano: 2027, mes: 1 });
  });
});

describe("competenciaDePagamento (mês do vencimento)", () => {
  // compra na fatura ABERTA (pelo fechamento) e rotulada pelo mês em que VENCE
  it("vencimento depois do fechamento: vence no mesmo mês do fechamento", () => {
    // fecha 4, vence 10 (ex.: Itaú). Compra 15/set -> fatura fecha em out -> vence 10/out
    expect(competenciaDePagamento(new Date(2026, 8, 15), 4, 10)).toEqual({ ano: 2026, mes: 10 });
  });
  it("fecha no fim, vence no começo: vence no mês seguinte ao fechamento", () => {
    // fecha 28, vence 6 (ex.: Nubank). Compra 15/set -> fatura fecha 28/set -> vence 6/out
    expect(competenciaDePagamento(new Date(2026, 8, 15), 28, 6)).toEqual({ ano: 2026, mes: 10 });
    // compra 30/set (após o fechamento) -> fatura fecha 28/out -> vence 6/nov
    expect(competenciaDePagamento(new Date(2026, 8, 30), 28, 6)).toEqual({ ano: 2026, mes: 11 });
  });
});

describe("proximaCompetencia", () => {
  it("avança um mês", () => {
    expect(proximaCompetencia({ ano: 2026, mes: 3 })).toEqual({ ano: 2026, mes: 4 });
  });
  it("vira o ano em dezembro", () => {
    expect(proximaCompetencia({ ano: 2026, mes: 12 })).toEqual({ ano: 2027, mes: 1 });
  });
});

describe("fechamento pelo calendário (N dias antes do vencimento)", () => {
  // Nubank do Luiz: vence 7, fecha 7 dias antes
  const nubank = { dia_fechamento: 30, dia_vencimento: 7, dias_fechamento_antes: 7 };
  // Itaú: vence 10, fecha 6 dias antes
  const itau = { dia_fechamento: 4, dia_vencimento: 10, dias_fechamento_antes: 6 };

  it("fecha em dias diferentes conforme o tamanho do mês", () => {
    expect(fechamentoDaFatura(nubank, { ano: 2026, mes: 11 })).toEqual({ ano: 2026, mes: 10, dia: 31 });
    expect(fechamentoDaFatura(nubank, { ano: 2026, mes: 12 })).toEqual({ ano: 2026, mes: 11, dia: 30 });
    expect(fechamentoDaFatura(nubank, { ano: 2027, mes: 3 })).toEqual({ ano: 2027, mes: 2, dia: 28 });
    expect(fechamentoDaFatura(nubank, { ano: 2028, mes: 3 })).toEqual({ ano: 2028, mes: 2, dia: 29 });
    expect(fechamentoDaFatura(itau, { ano: 2026, mes: 3 })).toEqual({ ano: 2026, mes: 3, dia: 4 });
  });

  it("compra em 30/10 ainda entra na fatura que fecha 31/10 (vence em novembro)", () => {
    expect(faturaDaCompra({ ano: 2026, mes: 10, dia: 30 }, nubank)).toEqual({ ano: 2026, mes: 11 });
    expect(faturaDaCompra({ ano: 2026, mes: 10, dia: 31 }, nubank)).toEqual({ ano: 2026, mes: 12 });
    expect(faturaDaCompra({ ano: 2026, mes: 11, dia: 29 }, nubank)).toEqual({ ano: 2026, mes: 12 });
    expect(faturaDaCompra({ ano: 2026, mes: 11, dia: 30 }, nubank)).toEqual({ ano: 2027, mes: 1 });
    expect(faturaDaCompra({ ano: 2027, mes: 2, dia: 27 }, nubank)).toEqual({ ano: 2027, mes: 3 });
    expect(faturaDaCompra({ ano: 2027, mes: 2, dia: 28 }, nubank)).toEqual({ ano: 2027, mes: 4 });
  });

  it("competenciaDePagamento usa o calendário quando há dias antes", () => {
    expect(competenciaDePagamento(new Date(2026, 9, 30), 30, 7, 7)).toEqual({ ano: 2026, mes: 11 });
    expect(competenciaDePagamento(new Date(2026, 9, 3), 4, 10, 6)).toEqual({ ano: 2026, mes: 10 });
    expect(competenciaDePagamento(new Date(2026, 9, 4), 4, 10, 6)).toEqual({ ano: 2026, mes: 11 });
  });

  it("sem dias antes, mantém a regra antiga (dia fixo)", () => {
    const antigo = { dia_fechamento: 28, dia_vencimento: 6 };
    expect(faturaDaCompra({ ano: 2026, mes: 9, dia: 15 }, antigo)).toEqual(competenciaDePagamento(new Date(2026, 8, 15), 28, 6));
    expect(faturaDaCompra({ ano: 2026, mes: 9, dia: 30 }, antigo)).toEqual(competenciaDePagamento(new Date(2026, 8, 30), 28, 6));
  });

  it("aviso de 'fecha amanhã' bate com o calendário", () => {
    expect(faturaFechaNoDia(nubank, { ano: 2026, mes: 10, dia: 31 })).toBe(true);
    expect(faturaFechaNoDia(nubank, { ano: 2026, mes: 10, dia: 30 })).toBe(false);
    expect(faturaFechaNoDia(nubank, { ano: 2026, mes: 11, dia: 30 })).toBe(true);
  });
});

describe("mesDaFatura (mês de consumo da fatura)", () => {
  const nubankLuiz = { dia_fechamento: 30, dia_vencimento: 7, dias_fechamento_antes: 7 };
  const nubankAna = { dia_fechamento: 29, dia_vencimento: 6, dias_fechamento_antes: 7 };
  const itau = { dia_fechamento: 4, dia_vencimento: 10, dias_fechamento_antes: 6 };
  it("fatura que fecha no fim do mês é daquele mês", () => {
    expect(mesDaFatura(nubankLuiz, { ano: 2026, mes: 11 })).toEqual({ ano: 2026, mes: 10 }); // fecha 31/10
    expect(mesDaFatura(nubankLuiz, { ano: 2026, mes: 12 })).toEqual({ ano: 2026, mes: 11 }); // fecha 30/11
    expect(mesDaFatura(nubankAna, { ano: 2026, mes: 11 })).toEqual({ ano: 2026, mes: 10 });
  });
  it("fatura que fecha no começo do mês é do mês anterior", () => {
    expect(mesDaFatura(itau, { ano: 2026, mes: 11 })).toEqual({ ano: 2026, mes: 10 }); // fecha 04/11
  });
  it("compra de 31/10 no Nubank (já fechado) conta em novembro", () => {
    const fat = faturaDaCompra({ ano: 2026, mes: 10, dia: 31 }, nubankLuiz);
    expect(mesDaFatura(nubankLuiz, fat)).toEqual({ ano: 2026, mes: 11 });
    const antes = faturaDaCompra({ ano: 2026, mes: 10, dia: 30 }, nubankLuiz);
    expect(mesDaFatura(nubankLuiz, antes)).toEqual({ ano: 2026, mes: 10 });
  });
});
