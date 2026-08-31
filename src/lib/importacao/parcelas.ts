import { normalizeDescricao } from "@/lib/financeiro/descricao";

// "3/12", "03 / 12" → { parcela_n: 3, total: 12 }. Ignora coisas como "1/2 kg".
const RE_PARCELA = /\b(\d{1,2})\s*\/\s*(\d{1,2})\b/;

export function lerParcela(descricao: string): { parcela_n: number; total: number } | null {
  const m = (descricao ?? "").match(RE_PARCELA);
  if (!m) return null;
  const parcela_n = Number(m[1]);
  const total = Number(m[2]);
  if (parcela_n >= 1 && total >= 2 && parcela_n <= total) return { parcela_n, total };
  return null;
}

// Remove o marcador "k/M" pra sobrar o nome da compra, usado pra casar parcelas
// da mesma compra entre faturas diferentes.
export function baseDescricao(descricao: string): string {
  return (descricao ?? "").replace(RE_PARCELA, "").replace(/\s{2,}/g, " ").trim();
}

// Assinatura que identifica a mesma compra parcelada (mesmo cartão): nome
// normalizado + total de parcelas.
export function assinaturaParcela(cardId: string, descricao: string, total: number): string {
  return `${cardId}|${normalizeDescricao(baseDescricao(descricao))}|${total}`;
}

export type TxParcela = {
  grupo_parcela: string | null;
  card_id: string | null;
  descricao: string | null;
  valor_centavos: number;
  total_parcelas: number;
  parcela_n: number;
  cartaoNome?: string;
};

export type CompraParcelada = {
  chave: string;
  descricao: string;
  cartaoNome: string;
  valorParcelaCentavos: number;
  total: number;
  ultima: number; // maior parcela já vista
  faltam: number; // total - ultima
  quitada: boolean;
};

// Agrupa lançamentos parcelados de cartão numa compra só, calculando quantas
// parcelas faltam. Agrupa por grupo_parcela; sem grupo, cai na assinatura.
export function agruparParcelas(txs: TxParcela[]): CompraParcelada[] {
  const grupos = new Map<string, TxParcela[]>();
  for (const t of txs) {
    if (t.total_parcelas <= 1) continue;
    const chave = t.grupo_parcela ?? assinaturaParcela(t.card_id ?? "", t.descricao ?? "", t.total_parcelas);
    (grupos.get(chave) ?? grupos.set(chave, []).get(chave)!).push(t);
  }

  const compras: CompraParcelada[] = [];
  for (const [chave, itens] of grupos) {
    const total = Math.max(...itens.map((i) => i.total_parcelas));
    const ultima = Math.max(...itens.map((i) => i.parcela_n));
    const ref = itens.reduce((a, b) => (b.parcela_n > a.parcela_n ? b : a), itens[0]);
    compras.push({
      chave,
      descricao: baseDescricao(ref.descricao ?? "") || (ref.descricao ?? "compra"),
      cartaoNome: ref.cartaoNome ?? "cartão",
      valorParcelaCentavos: ref.valor_centavos,
      total,
      ultima,
      faltam: Math.max(0, total - ultima),
      quitada: ultima >= total,
    });
  }
  // ativas (faltando) primeiro, depois por quanto falta
  return compras.sort((a, b) => Number(a.quitada) - Number(b.quitada) || b.faltam - a.faltam);
}
