import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { planilhaParaTexto } from "./planilha";

function planilha(linhas: (string | number)[][], nome = "Fatura"): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, nome);
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

describe("planilhaParaTexto", () => {
  it("converte a planilha em CSV com os lançamentos", () => {
    const texto = planilhaParaTexto(planilha([
      ["Data", "Descrição", "Valor"],
      ["2026-09-10", "Mercado do mês", "150,00"],
      ["2026-09-11", "Uber", "23,90"],
    ]));
    expect(texto).toContain("Mercado do mês");
    expect(texto).toContain("Uber");
    expect(texto).toContain("2026-09-10");
  });

  it("junta as abas com conteúdo, prefixando o nome", () => {
    const ws1 = XLSX.utils.aoa_to_sheet([["Descrição"], ["Compra A"]]);
    const ws2 = XLSX.utils.aoa_to_sheet([["Descrição"], ["Compra B"]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "Set");
    XLSX.utils.book_append_sheet(wb, ws2, "Out");
    const texto = planilhaParaTexto(Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" })));
    expect(texto).toContain("# Set");
    expect(texto).toContain("# Out");
    expect(texto).toContain("Compra A");
    expect(texto).toContain("Compra B");
  });
});
