import type { LinhaImportada } from "./extrair";

export function marcarDuplicados(
  linhas: LinhaImportada[],
  existentes: { data_compra: string; valor_centavos: number }[],
): (LinhaImportada & { duplicada: boolean })[] {
  const chaves = new Set(existentes.map((e) => `${e.data_compra}|${e.valor_centavos}`));
  return linhas.map((l) => ({ ...l, duplicada: chaves.has(`${l.data}|${l.valor_centavos}`) }));
}
