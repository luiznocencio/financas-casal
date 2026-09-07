import { normalizeDescricao } from "@/lib/financeiro/descricao";

// Marcador de parcela "k/M". Global e SEM \b: o banco às vezes cola o marcador no
// texto ("Pague menos 01602/04", "representa03/10"), então varremos todas as
// ocorrências e ficamos com a ÚLTIMA válida (o marcador costuma vir no fim).
const RE_MARCA = /(\d{1,2})\s*\/\s*(\d{1,2})/g;

function marcadorValido(n: number, total: number): boolean {
  return n >= 1 && total >= 2 && n <= total && total <= 72;
}

function acharMarcador(s: string): { index: number; length: number; parcela_n: number; total: number } | null {
  let achado: { index: number; length: number; parcela_n: number; total: number } | null = null;
  for (const m of (s ?? "").matchAll(RE_MARCA)) {
    const n = Number(m[1]);
    const total = Number(m[2]);
    if (marcadorValido(n, total)) achado = { index: m.index ?? 0, length: m[0].length, parcela_n: n, total };
  }
  return achado; // última ocorrência válida
}

export function lerParcela(descricao: string): { parcela_n: number; total: number } | null {
  const m = acharMarcador(descricao);
  return m ? { parcela_n: m.parcela_n, total: m.total } : null;
}

// Remove o marcador "k/M" (e a palavra "parcela") pra sobrar o nome da compra,
// usado pra casar parcelas da mesma compra entre faturas diferentes. Preserva
// caixa/acentos (a normalização é feita por quem casa).
export function baseDescricao(descricao: string): string {
  const semPalavra = (descricao ?? "").replace(/\bparcelas?\b/gi, " ");
  const m = acharMarcador(semPalavra);
  const semMarca = m ? semPalavra.slice(0, m.index) + semPalavra.slice(m.index + m.length) : semPalavra;
  return semMarca.replace(/[-–—]\s*$/, "").replace(/\s{2,}/g, " ").trim();
}

// Nome base canônico (minúsculo, sem marcador) — chave estável pra casar a mesma
// compra e pras regras aprendidas de nome/categoria.
export function nomeBase(descricao: string): string {
  return normalizeDescricao(baseDescricao(descricao));
}

// Aplica um nome amigável preservando o marcador de parcela do texto original
// (preferida "Reforma" + original "Carajás 9/10" -> "Reforma 9/10"), pra não
// quebrar a detecção de parcela nem esconder qual parcela é.
export function nomeComMarcador(preferida: string, original: string): string {
  const p = lerParcela(original);
  return p ? `${preferida} ${p.parcela_n}/${p.total}` : preferida;
}

// Assinatura que identifica a mesma compra parcelada (mesmo cartão): nome base +
// total de parcelas.
export function assinaturaParcela(cardId: string, descricao: string, total: number): string {
  return `${cardId}|${nomeBase(descricao)}|${total}`;
}

export type TxParcela = {
  id?: string;
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
  cardId: string;
  nomeBase: string;
  descricao: string;
  cartaoNome: string;
  valorParcelaCentavos: number;
  total: number;
  ultima: number; // maior parcela já vista
  faltam: number; // total - ultima
  quitada: boolean;
  txIds: string[]; // lançamentos que compõem a compra (renomear/mesclar operam neles)
};

// Duas compras são a MESMA (variações do texto do banco entre faturas): mesmo
// cartão, mesmo total, mesmo valor de parcela e nome base equivalente (um é
// prefixo do outro — cobre "Unidas locadora" vs "Unidas locadora sa").
export function mesmaCompra(a: CompraParcelada, b: CompraParcelada): boolean {
  if (!a.cardId || a.cardId !== b.cardId) return false;
  if (a.total !== b.total) return false;
  if (a.valorParcelaCentavos !== b.valorParcelaCentavos) return false;
  const x = a.nomeBase, y = b.nomeBase;
  return !!x && !!y && (x === y || x.startsWith(y) || y.startsWith(x));
}

function fundirMesmaCompra(compras: CompraParcelada[]): CompraParcelada[] {
  const res: CompraParcelada[] = [];
  for (const c of compras) {
    const alvo = res.find((r) => mesmaCompra(r, c));
    if (!alvo) { res.push({ ...c, txIds: [...c.txIds] }); continue; }
    alvo.txIds.push(...c.txIds);
    if (c.ultima > alvo.ultima) { alvo.ultima = c.ultima; alvo.descricao = c.descricao; }
    // nome base canônico = o mais curto (prefixo comum), pra casar melhor no futuro
    if (c.nomeBase.length < alvo.nomeBase.length && alvo.nomeBase.startsWith(c.nomeBase)) alvo.nomeBase = c.nomeBase;
    alvo.faltam = Math.max(0, alvo.total - alvo.ultima);
    alvo.quitada = alvo.ultima >= alvo.total;
  }
  return res;
}

// Agrupa lançamentos parcelados de cartão numa compra só, calculando quantas
// parcelas faltam. Agrupa por grupo_parcela; sem grupo, cai na assinatura; por
// fim funde grupos que são a mesma compra (texto do banco variou entre faturas).
export function agruparParcelas(txs: TxParcela[]): CompraParcelada[] {
  const grupos = new Map<string, TxParcela[]>();
  for (const t of txs) {
    if (t.total_parcelas <= 1) continue;
    const chave = t.grupo_parcela ?? assinaturaParcela(t.card_id ?? "", t.descricao ?? "", t.total_parcelas);
    (grupos.get(chave) ?? grupos.set(chave, []).get(chave)!).push(t);
  }

  const compras: CompraParcelada[] = [];
  for (const [chave, itens] of grupos) {
    // total e parcela_n confiáveis: lê do texto (marcador), cai pro armazenado
    const totais = itens.map((i) => lerParcela(i.descricao ?? "")?.total ?? i.total_parcelas);
    const ns = itens.map((i) => lerParcela(i.descricao ?? "")?.parcela_n ?? i.parcela_n);
    const total = Math.max(...totais);
    const ultima = Math.max(...ns);
    const ref = itens[ns.indexOf(ultima)] ?? itens[0];
    compras.push({
      chave,
      cardId: ref.card_id ?? "",
      nomeBase: nomeBase(ref.descricao ?? ""),
      descricao: baseDescricao(ref.descricao ?? "") || (ref.descricao ?? "compra"),
      cartaoNome: ref.cartaoNome ?? "cartão",
      valorParcelaCentavos: ref.valor_centavos,
      total,
      ultima,
      faltam: Math.max(0, total - ultima),
      quitada: ultima >= total,
      txIds: itens.map((i) => i.id).filter((x): x is string => !!x),
    });
  }

  // ativas (faltando) primeiro, depois por quanto falta
  return fundirMesmaCompra(compras).sort((a, b) => Number(a.quitada) - Number(b.quitada) || b.faltam - a.faltam);
}
