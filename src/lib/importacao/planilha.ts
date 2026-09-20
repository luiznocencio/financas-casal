import * as XLSX from "xlsx";

// Converte uma planilha (.xls/.xlsx/.ods) em texto CSV pra alimentar a mesma
// extração da IA usada num CSV colado. Junta as abas com conteúdo (prefixando o
// nome quando há mais de uma), pra não perder lançamentos que estejam em outra aba.
export function planilhaParaTexto(buffer: Buffer): string {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const partes: string[] = [];
  for (const nome of wb.SheetNames) {
    const ws = wb.Sheets[nome];
    if (!ws) continue;
    const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
    if (csv.trim()) partes.push(wb.SheetNames.length > 1 ? `# ${nome}\n${csv}` : csv);
  }
  return partes.join("\n\n").trim();
}
