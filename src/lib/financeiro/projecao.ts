import { resumoDoMes } from "./agregacoes";
import { contaVisivelNoMes, type ContaOcorrencia } from "./contas";
import { ultimoDiaDoMes } from "./fechamento";
import { recorrenteJaLancado } from "./recorrentes";

// Orçamento PROJETADO: além do que já foi gasto no mês (consumo), soma o que é
// CERTO de cair até o fim dele — gastos fixos ainda não lançados e contas a pagar
// pendentes. Parcelas futuras já existem como lançamentos (entram no gasto pela
// competência), então não precisam de projeção. Usado pelo Orçamento, pela Home
// e pelos avisos (cron) — uma regra só.

type Mes = { ano: number; mes: number };
const pad = (n: number) => String(n).padStart(2, "0");

export type TxOrc = {
  tipo: "despesa" | "receita" | "transferencia" | "transferencia_entrada";
  valor_centavos: number;
  pessoa: string;
  categoria_id: string | null;
  data_compra: string;
  card_id: string | null;
  account_id: string | null;
  invoice_id: string | null;
  total_parcelas: number;
  recorrente_id: string | null;
  conta_pagar_id: string | null;
  descricao: string | null;
};
export type FixoOrc = {
  id: string; descricao: string; valor_centavos: number; categoria_id: string | null;
  dia: number; card_id: string | null; account_id: string | null; data_fim: string | null; ativo: boolean;
};
export type ContaOrc = ContaOcorrencia & {
  id: string; descricao: string; categoria_id: string | null; valor_estimado_centavos: number | null; ativo?: boolean;
};
export type InvoiceOrc = { id: string; competencia_ano: number; competencia_mes: number };
export type CatOrc = { id: string; parent_id: string | null };
export type BudgetOrc = { categoria_id: string; valor_centavos: number };

export type ACair = { descricao: string; categoria_id: string | null; valor_centavos: number; origem: "fixo" | "conta" };

// Consumo = mês da compra; só a PARCELA conta pela competência da fatura.
export function comCompetenciaDeParcela<T extends TxOrc>(txs: T[], invoices: InvoiceOrc[]) {
  const comp = new Map(invoices.map((i) => [i.id, { ano: i.competencia_ano, mes: i.competencia_mes }]));
  return txs.map((t) =>
    t.card_id && t.total_parcelas > 1 && t.invoice_id && comp.has(t.invoice_id)
      ? { ...t, competencia: comp.get(t.invoice_id) }
      : t);
}

// O que ainda vai cair no mês: fixos não lançados + contas a pagar pendentes.
export function aCairNoMes(ref: Mes, p: { txs: TxOrc[]; invoices: InvoiceOrc[]; fixos: FixoOrc[]; contas: ContaOrc[] }): ACair[] {
  const ultimo = ultimoDiaDoMes(ref.ano, ref.mes);
  const ini = `${ref.ano}-${pad(ref.mes)}-01`;
  const fim = `${ref.ano}-${pad(ref.mes)}-${pad(ultimo)}`;
  const invDoMes = new Set(p.invoices.filter((i) => i.competencia_ano === ref.ano && i.competencia_mes === ref.mes).map((i) => i.id));
  // lançamentos do mês (mesma régua do "gerar fixos"): conta pela data, cartão pela fatura OU pela data
  const doMes = p.txs.filter((t) => (t.data_compra >= ini && t.data_compra <= fim) || (t.invoice_id != null && invDoMes.has(t.invoice_id)));

  const itens: ACair[] = [];
  for (const r of p.fixos) {
    if (!r.ativo) continue;
    const data = `${ref.ano}-${pad(ref.mes)}-${pad(Math.min(r.dia, ultimo))}`;
    if (r.data_fim && data > r.data_fim) continue; // encerrado
    if (recorrenteJaLancado(r, doMes)) continue;
    itens.push({ descricao: r.descricao, categoria_id: r.categoria_id, valor_centavos: r.valor_centavos, origem: "fixo" });
  }

  const pagaAlgumaVez = new Set(p.txs.filter((t) => t.conta_pagar_id).map((t) => t.conta_pagar_id));
  const pagaNoMes = new Set(p.txs.filter((t) => t.conta_pagar_id && t.data_compra >= ini && t.data_compra <= fim).map((t) => t.conta_pagar_id));
  for (const c of p.contas) {
    if (c.ativo === false || pagaNoMes.has(c.id)) continue;
    if (!contaVisivelNoMes(c, ref.ano, ref.mes, pagaAlgumaVez.has(c.id), false)) continue;
    const v = c.valor_estimado_centavos ?? 0;
    if (v > 0) itens.push({ descricao: c.descricao, categoria_id: c.categoria_id, valor_centavos: v, origem: "conta" });
  }
  return itens;
}

export type EstadoOrc = "estourou" | "vai_estourar" | "atencao" | "ok";

export type ItemOrcProjetado = {
  categoria_id: string;
  limite: number;
  gasto: number;
  aCair: number;
  projetado: number; // gasto + aCair
  estado: EstadoOrc;
  excesso: number;   // quanto passa (estourou: gasto−limite; vai_estourar: projetado−limite)
};

// Estado de uma categoria: estourou (já passou) > vai estourar (projeção passa)
// > atenção (≥ 90% do limite) > ok.
export function estadoCategoria(limite: number, gasto: number, aCair: number): { estado: EstadoOrc; excesso: number } {
  if (limite <= 0) return { estado: "ok", excesso: 0 };
  if (gasto > limite) return { estado: "estourou", excesso: gasto - limite };
  if (gasto + aCair > limite) return { estado: "vai_estourar", excesso: gasto + aCair - limite };
  if (gasto >= limite * 0.9) return { estado: "atencao", excesso: 0 };
  return { estado: "ok", excesso: 0 };
}

export type OrcamentoDoMes = {
  itens: ItemOrcProjetado[];                    // categorias-mãe COM orçamento
  gastoPorCategoria: Record<string, number>;    // sem rollup (filho no filho)
  gastoRollup: Record<string, number>;          // filho soma na mãe
  aCair: ACair[];
  aCairRollup: Record<string, number>;
  semOrcamento: { categoria_id: string; gasto: number }[]; // mães com gasto e sem limite
  semCategoria: number;                         // despesas sem categoria
  totalGasto: number;                           // todas as despesas do mês
  totalOrcado: number;
  totalGastoOrcado: number;                     // gasto nas categorias com orçamento
  totalProjetadoOrcado: number;                 // + o que vai cair nelas
};

export function orcamentoDoMes(ref: Mes, p: {
  cats: CatOrc[]; budgets: BudgetOrc[]; txs: TxOrc[]; invoices: InvoiceOrc[]; fixos: FixoOrc[]; contas: ContaOrc[];
}): OrcamentoDoMes {
  const paiDe = new Map(p.cats.filter((c) => c.parent_id).map((c) => [c.id, c.parent_id as string]));
  const mae = (id: string) => paiDe.get(id) ?? id;

  const rd = resumoDoMes(comCompetenciaDeParcela(p.txs, p.invoices), ref);
  const gastoRollup: Record<string, number> = {};
  for (const [id, v] of Object.entries(rd.porCategoria)) gastoRollup[mae(id)] = (gastoRollup[mae(id)] ?? 0) + v;
  const semCategoria = rd.totalDespesas - Object.values(rd.porCategoria).reduce((s, v) => s + v, 0);

  const aCair = aCairNoMes(ref, p);
  const aCairRollup: Record<string, number> = {};
  for (const a of aCair) if (a.categoria_id) aCairRollup[mae(a.categoria_id)] = (aCairRollup[mae(a.categoria_id)] ?? 0) + a.valor_centavos;

  const limitePor = new Map(p.budgets.filter((b) => b.valor_centavos > 0).map((b) => [b.categoria_id, b.valor_centavos]));
  const itens: ItemOrcProjetado[] = [...limitePor].map(([categoria_id, limite]) => {
    const gasto = gastoRollup[categoria_id] ?? 0;
    const ac = aCairRollup[categoria_id] ?? 0;
    return { categoria_id, limite, gasto, aCair: ac, projetado: gasto + ac, ...estadoCategoria(limite, gasto, ac) };
  });
  const semOrcamento = Object.entries(gastoRollup)
    .filter(([id, v]) => v > 0 && !limitePor.has(id))
    .map(([categoria_id, gasto]) => ({ categoria_id, gasto }))
    .sort((a, b) => b.gasto - a.gasto);

  return {
    itens, gastoPorCategoria: rd.porCategoria, gastoRollup, aCair, aCairRollup, semOrcamento, semCategoria,
    totalGasto: rd.totalDespesas,
    totalOrcado: itens.reduce((s, i) => s + i.limite, 0),
    totalGastoOrcado: itens.reduce((s, i) => s + i.gasto, 0),
    totalProjetadoOrcado: itens.reduce((s, i) => s + i.projetado, 0),
  };
}
