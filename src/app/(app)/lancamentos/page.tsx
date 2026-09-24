import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { LinhaEditavel } from "@/components/lancamentos/LinhaEditavel";
import { FiltrosExtrato } from "@/components/lancamentos/FiltrosExtrato";
import { BarraOrcamento } from "@/components/orcamento/BarraOrcamento";
import { CategoriaPonto } from "@/components/ui/CategoriaTag";
import { Money } from "@/components/ui/Money";
import { resumoDoMes } from "@/lib/financeiro/agregacoes";
import { ultimoDiaDoMes } from "@/lib/financeiro/fechamento";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const pad = (n: number) => String(n).padStart(2, "0");

export default async function Lancamentos({
  searchParams,
}: {
  searchParams: Promise<{ pessoa?: string; card?: string; categoria?: string; invoice?: string; tipo?: string; origem?: string; de?: string; ate?: string; busca?: string; mes?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createServerSupabase();

  // dados de referência primeiro (o filtro por pessoa depende dos titulares)
  const [membrosRes, categoriasRes, cardsRes, contasRes, budgetsRes, invoicesRes] = await Promise.all([
    supabase.from("members").select("nome"),
    supabase.from("categories").select("id, nome, cor, parent_id, tipo"),
    supabase.from("cards").select("id, nome, titular"),
    supabase.from("accounts").select("id, nome, titular"),
    supabase.from("budgets").select("categoria_id, valor_centavos"),
    supabase.from("invoices").select("id, competencia_ano, competencia_mes"),
  ]);
  const refErro = membrosRes.error ?? categoriasRes.error ?? cardsRes.error ?? contasRes.error ?? budgetsRes.error ?? invoicesRes.error;
  if (refErro) throw new Error(`Falha ao carregar o extrato: ${refErro.message}`);
  const membros = (membrosRes.data ?? []).map((m) => m.nome);
  const categorias = categoriasRes.data ?? [];
  const cartoes = cardsRes.data ?? [];
  const contas = contasRes.data ?? [];
  const budgets = budgetsRes.data ?? [];
  const invoices = invoicesRes.data ?? [];

  // mês de referência (competência): compra no cartão conta no mês da fatura, não
  // da data — respeita cartões que fecham ainda no mês anterior.
  const mesRef = sp.mes && /^\d{4}-\d{2}$/.test(sp.mes)
    ? { ano: Number(sp.mes.slice(0, 4)), mes: Number(sp.mes.slice(5, 7)) } : null;
  const mesValido = mesRef && mesRef.mes >= 1 && mesRef.mes <= 12 ? mesRef : null;

  let q = supabase
    .from("transactions")
    .select("id, descricao, data_compra, pessoa, parcela_n, total_parcelas, tipo, valor_centavos, categoria_id, card_id, account_id, recorrente_id, observacao")
    .order("data_compra", { ascending: false })
    .limit(200);
  if (sp.card) q = q.eq("card_id", sp.card);
  if (sp.invoice) q = q.eq("invoice_id", sp.invoice);
  if (sp.tipo === "despesa" || sp.tipo === "receita") q = q.eq("tipo", sp.tipo);
  if (sp.origem === "cartao") q = q.not("card_id", "is", null);
  if (sp.origem === "pix") q = q.not("account_id", "is", null);
  if (sp.de) q = q.gte("data_compra", sp.de);
  if (sp.ate) q = q.lte("data_compra", sp.ate);
  // mês do CONSUMO: à vista (pix e cartão) pela data; parcela pela fatura do mês
  if (mesValido) {
    const ini = `${mesValido.ano}-${pad(mesValido.mes)}-01`;
    const fim = `${mesValido.ano}-${pad(mesValido.mes)}-${pad(ultimoDiaDoMes(mesValido.ano, mesValido.mes))}`;
    const invIds = invoices.filter((i) => i.competencia_ano === mesValido.ano && i.competencia_mes === mesValido.mes).map((i) => i.id);
    const partes = [`and(total_parcelas.lte.1,data_compra.gte.${ini},data_compra.lte.${fim})`];
    if (invIds.length) partes.push(`and(total_parcelas.gt.1,invoice_id.in.(${invIds.join(",")}))`);
    q = q.or(partes.join(","));
  }
  if (sp.busca?.trim()) q = q.ilike("descricao", `%${sp.busca.trim()}%`);
  // categoria: se for uma categoria-mãe, inclui as subcategorias; senão, exata
  if (sp.categoria) {
    const filhos = categorias.filter((c) => c.parent_id === sp.categoria).map((c) => c.id);
    q = filhos.length ? q.in("categoria_id", [sp.categoria, ...filhos]) : q.eq("categoria_id", sp.categoria);
  }
  // pessoa: filtra pelos cartões e contas dela (titular)
  if (sp.pessoa) {
    const cardIds = cartoes.filter((c) => c.titular === sp.pessoa).map((c) => c.id);
    const accIds = contas.filter((c) => c.titular === sp.pessoa).map((c) => c.id);
    const ors: string[] = [];
    if (cardIds.length) ors.push(`card_id.in.(${cardIds.join(",")})`);
    if (accIds.length) ors.push(`account_id.in.(${accIds.join(",")})`);
    q = ors.length ? q.or(ors.join(",")) : q.eq("id", "00000000-0000-0000-0000-000000000000");
  }

  const { data: txs, error } = await q;
  if (error) throw new Error(`Falha ao carregar o extrato: ${error.message}`);
  const temFiltro = !!(sp.pessoa || sp.card || sp.categoria || sp.invoice || sp.tipo || sp.origem || sp.de || sp.ate || sp.busca || sp.mes);
  // totais do que está listado (respeita o filtro)
  const somaDespesas = (txs ?? []).filter((t) => t.tipo === "despesa").reduce((s, t) => s + t.valor_centavos, 0);
  const somaReceitas = (txs ?? []).filter((t) => t.tipo === "receita").reduce((s, t) => s + t.valor_centavos, 0);

  // barra de status do orçamento da categoria filtrada (no mês escolhido, ou no
  // mês atual). O limite fica na categoria-mãe; o gasto soma mãe + subcategorias.
  const catFiltrada = sp.categoria ? categorias.find((c) => c.id === sp.categoria) : null;
  let barraOrcamento: { nome: string; cor: string; gasto: number; limite: number; mesLabel: string } | null = null;
  if (catFiltrada) {
    const mae = categorias.find((c) => c.id === (catFiltrada.parent_id ?? catFiltrada.id)) ?? catFiltrada;
    const filhosIds = categorias.filter((c) => c.parent_id === mae.id).map((c) => c.id);
    const rollupIds = [mae.id, ...filhosIds];
    const agora = new Date();
    const bm = mesValido ?? { ano: agora.getFullYear(), mes: agora.getMonth() + 1 };
    const { data: txsCat } = await supabase
      .from("transactions")
      .select("categoria_id, tipo, pessoa, valor_centavos, data_compra, card_id, invoice_id, total_parcelas")
      .in("categoria_id", rollupIds);
    const compPorInvoice = new Map(invoices.map((i) => [i.id, { ano: i.competencia_ano, mes: i.competencia_mes }]));
    // consumo: à vista pela data; parcela pela competência
    const txsRef = (txsCat ?? []).map((t) =>
      t.card_id && t.total_parcelas > 1 && t.invoice_id && compPorInvoice.has(t.invoice_id) ? { ...t, competencia: compPorInvoice.get(t.invoice_id) } : t);
    const rd = resumoDoMes(txsRef, bm);
    const gasto = rollupIds.reduce((s, id) => s + (rd.porCategoria[id] ?? 0), 0);
    const limite = budgets.find((b) => b.categoria_id === mae.id)?.valor_centavos ?? 0;
    barraOrcamento = { nome: mae.nome, cor: mae.cor, gasto, limite, mesLabel: `${MESES[bm.mes - 1]}${bm.ano !== new Date().getFullYear() ? ` ${bm.ano}` : ""}` };
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-[var(--text)]">Extrato</h1>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Link href="/planejamento" className="text-sm text-[var(--accent)]">Planejamento</Link>
            <Link href="/importar" className="text-sm text-[var(--accent)]">Importar</Link>
          </div>
        </div>
        <p className="text-sm text-[var(--muted)]">
          Últimos lançamentos do casal, do mais recente para o mais antigo.
        </p>
      </header>

      <FiltrosExtrato categorias={categorias} cartoes={cartoes} membros={membros} />

      {barraOrcamento && (
        <Card>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-medium text-[var(--text)]">
              <CategoriaPonto cor={barraOrcamento.cor} />{barraOrcamento.nome}
            </span>
            <span className="text-xs capitalize text-[var(--muted)]">{barraOrcamento.mesLabel}</span>
          </div>
          <BarraOrcamento gastoCentavos={barraOrcamento.gasto} limiteCentavos={barraOrcamento.limite} cor={barraOrcamento.cor} />
        </Card>
      )}

      {(txs ?? []).length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">
            Nenhum lançamento encontrado{temFiltro ? " para esse filtro" : ""}.
          </p>
        </Card>
      ) : (
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[var(--border)] pb-3 text-sm">
            <span className="text-[var(--muted)]">
              {(txs ?? []).length} lançamento{(txs ?? []).length === 1 ? "" : "s"}{(txs ?? []).length >= 200 ? " (200 mais recentes)" : ""}
            </span>
            <span className="flex flex-wrap items-center gap-x-3">
              {somaDespesas > 0 && <span className="text-[var(--text)]">Gasto <strong><Money centavos={somaDespesas} tamanho="sm" /></strong></span>}
              {somaReceitas > 0 && <span style={{ color: "var(--positivo)" }}>Recebido <strong><Money centavos={somaReceitas} tamanho="sm" /></strong></span>}
            </span>
          </div>
          <ul className="flex flex-col gap-0">
            {(txs ?? []).map((t) => (
              <LinhaEditavel key={t.id} tx={t} categorias={categorias} membros={membros} cartoes={cartoes} />
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}
