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
import { todas } from "@/lib/supabase/todas";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const pad = (n: number) => String(n).padStart(2, "0");
const POR_PAGINA = 100;

// o mínimo do query builder do Supabase que os filtros do extrato usam (os
// tipos genéricos do builder são fundos demais pro TS checar estruturalmente)
interface Filtro {
  eq(coluna: string, valor: string): Filtro;
  not(coluna: string, op: string, valor: null): Filtro;
  gte(coluna: string, valor: string): Filtro;
  lte(coluna: string, valor: string): Filtro;
  or(filtro: string): Filtro;
  ilike(coluna: string, padrao: string): Filtro;
  in(coluna: string, valores: string[]): Filtro;
}

export default async function Lancamentos({
  searchParams,
}: {
  searchParams: Promise<{ pessoa?: string; card?: string; categoria?: string; invoice?: string; tipo?: string; origem?: string; de?: string; ate?: string; busca?: string; mes?: string; pagina?: string }>;
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

  // filtros num lugar só: a página da lista e os totais usam exatamente os mesmos
  const invIdsMes = mesValido
    ? invoices.filter((i) => i.competencia_ano === mesValido.ano && i.competencia_mes === mesValido.mes).map((i) => i.id)
    : [];
  const filtrar = <Q,>(builder: Q): Q => {
    let q = builder as unknown as Filtro;
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
      const partes = [`and(total_parcelas.lte.1,data_compra.gte.${ini},data_compra.lte.${fim})`];
      if (invIdsMes.length) partes.push(`and(total_parcelas.gt.1,invoice_id.in.(${invIdsMes.join(",")}))`);
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
    return q as unknown as Q;
  };

  const pagina = Math.max(1, Math.floor(Number(sp.pagina)) || 1);
  const [listaRes, totaisRes] = await Promise.all([
    filtrar(supabase
      .from("transactions")
      .select("id, descricao, data_compra, pessoa, parcela_n, total_parcelas, tipo, valor_centavos, categoria_id, card_id, account_id, recorrente_id, observacao", { count: "exact" }))
      .order("data_compra", { ascending: false })
      .order("id")
      .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1),
    // totais sobre TUDO que o filtro pega (não só a página)
    todas((de, ate) => filtrar(supabase.from("transactions").select("tipo, valor_centavos")).order("id").range(de, ate)),
  ]);
  const { data: txs, error, count } = listaRes;
  if (error ?? totaisRes.error) throw new Error(`Falha ao carregar o extrato: ${(error ?? totaisRes.error)!.message}`);
  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const temFiltro = !!(sp.pessoa || sp.card || sp.categoria || sp.invoice || sp.tipo || sp.origem || sp.de || sp.ate || sp.busca || sp.mes);
  const somaDespesas = totaisRes.data.filter((t) => t.tipo === "despesa").reduce((s, t) => s + t.valor_centavos, 0);
  const somaReceitas = totaisRes.data.filter((t) => t.tipo === "receita").reduce((s, t) => s + t.valor_centavos, 0);
  // link pra outra página mantendo os filtros
  const hrefPagina = (n: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== "pagina") u.set(k, v);
    if (n > 1) u.set("pagina", String(n));
    const qs = u.toString();
    return qs ? `/lancamentos?${qs}` : "/lancamentos";
  };

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
    const { data: txsCat } = await todas((de, ate) => supabase
      .from("transactions")
      .select("categoria_id, tipo, pessoa, valor_centavos, data_compra, card_id, invoice_id, total_parcelas")
      .in("categoria_id", rollupIds).order("id").range(de, ate));
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
              {total} lançamento{total === 1 ? "" : "s"}{paginas > 1 ? ` · mostrando ${(pagina - 1) * POR_PAGINA + 1}–${Math.min(pagina * POR_PAGINA, total)}` : ""}
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
          {paginas > 1 && (
            <nav className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3 text-sm" aria-label="Páginas do extrato">
              {pagina > 1
                ? <Link href={hrefPagina(pagina - 1)} className="text-[var(--accent)]">‹ Mais recentes</Link>
                : <span />}
              <span className="text-[var(--muted)]">Página {pagina} de {paginas}</span>
              {pagina < paginas
                ? <Link href={hrefPagina(pagina + 1)} className="text-[var(--accent)]">Mais antigos ›</Link>
                : <span />}
            </nav>
          )}
        </Card>
      )}
    </main>
  );
}
