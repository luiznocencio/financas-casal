import type { LinhaImportada } from "./extrair";

const DIA_MS = 86_400_000;

function dias(iso: string): number {
  return new Date(iso + "T12:00:00").getTime();
}

/**
 * Marca cada linha importada que já parece existir (para não duplicar quando o
 * usuário sobe a fatura depois de já ter lançado à mão).
 *
 * Casamento: mesmo VALOR e data dentro de `janelaDias` (o dia do lançamento
 * manual costuma diferir um pouco do dia que aparece na fatura). É GULOSO e
 * 1-a-1: cada existente casa com no máximo uma linha (a de data mais próxima),
 * então "2 cafés de R$10, só 1 já lançado" marca apenas 1 como duplicado.
 */
export function marcarDuplicados(
  linhas: LinhaImportada[],
  existentes: { data_compra: string; valor_centavos: number; tipo?: string }[],
  janelaDias = 4,
): (LinhaImportada & { duplicada: boolean })[] {
  const pool = existentes.map((e) => ({ ...e, usado: false }));
  return linhas.map((l) => {
    const alvo = dias(l.data);
    let melhorIdx = -1;
    let melhorDist = Infinity;
    for (let i = 0; i < pool.length; i++) {
      const e = pool[i];
      if (e.usado || e.valor_centavos !== l.valor_centavos) continue;
      if (e.tipo !== undefined && e.tipo !== l.tipo) continue; // receita não casa com despesa
      const dist = Math.abs(dias(e.data_compra) - alvo) / DIA_MS;
      if (dist <= janelaDias && dist < melhorDist) { melhorDist = dist; melhorIdx = i; }
    }
    if (melhorIdx >= 0) { pool[melhorIdx].usado = true; return { ...l, duplicada: true }; }
    return { ...l, duplicada: false };
  });
}
