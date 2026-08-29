import type { LinhaImportada } from "./extrair";
import { normalizeDescricao } from "@/lib/financeiro/descricao";

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
 *
 * Gasto fixo (recorrente) já materializado casa quando o VALOR e o TIPO batem e
 * ( a DESCRIÇÃO normalizada é igual OU a data cai dentro da janela de 27 dias ) —
 * assim um fixo já lançado em OUTRO cartão/conta é reconhecido mesmo que a fatura
 * mostre o mesmo lançamento num dia bem distante do mês.
 */
export function marcarDuplicados(
  linhas: LinhaImportada[],
  existentes: { data_compra: string; valor_centavos: number; tipo?: string; recorrente?: boolean; descricao?: string }[],
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
      let casa: boolean;
      if (e.recorrente) {
        // gasto fixo: casa dentro de 27 dias, ou por descrição igual DESDE QUE no
        // mesmo mês (senão suprimiria a cobrança de meses seguintes de mesmo valor)
        const mesmoMes = e.data_compra.slice(0, 7) === l.data.slice(0, 7);
        const descIgual = e.descricao != null && normalizeDescricao(e.descricao) === normalizeDescricao(l.descricao);
        casa = dist <= 27 || (descIgual && mesmoMes);
      } else {
        casa = dist <= janelaDias;
      }
      // guloso: entre os que casam, escolhe o de data mais próxima
      if (casa && dist < melhorDist) { melhorDist = dist; melhorIdx = i; }
    }
    if (melhorIdx >= 0) { pool[melhorIdx].usado = true; return { ...l, duplicada: true }; }
    return { ...l, duplicada: false };
  });
}
