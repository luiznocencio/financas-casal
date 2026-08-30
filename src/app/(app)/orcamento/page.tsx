import { createServerSupabase } from "@/lib/supabase/server";
import { resumoOrcamento } from "@/lib/financeiro/orcamento";
import { resumoDoMes } from "@/lib/financeiro/agregacoes";
import { Money } from "@/components/ui/Money";
import { Card } from "@/components/ui/Card";
import Link from "next/link";
import { RendaCasal } from "@/components/orcamento/RendaCasal";
import { PercentualEditor } from "@/components/orcamento/PercentualEditor";
import { EditarCategoria } from "@/components/orcamento/EditarCategoria";
import { AddCategoriaForm } from "@/components/orcamento/AddCategoriaForm";
import { CategoriaPonto } from "@/components/ui/CategoriaTag";

export default async function OrcamentoPage() {
  const supabase = await createServerSupabase();
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1;

  const [membrosRes, catsRes, budgetsRes, txsRes] = await Promise.all([
    supabase.from("members").select("user_id, nome, renda_mensal_centavos").order("papel"),
    supabase.from("categories").select("id, nome, cor").eq("tipo", "despesa").order("nome"),
    supabase.from("budgets").select("categoria_id, percentual"),
    supabase.from("transactions").select("categoria_id, tipo, pessoa, valor_centavos, data_compra"),
  ]);
  const erro = membrosRes.error ?? catsRes.error ?? budgetsRes.error ?? txsRes.error;
  if (erro) throw new Error(`Falha ao carregar o orçamento: ${erro.message}`);

  const membros = membrosRes.data ?? [];
  const renda = membros.reduce((s, m) => s + (m.renda_mensal_centavos ?? 0), 0);
  const cats = catsRes.data ?? [];
  const budgets = budgetsRes.data ?? [];

  // reusa a agregação do mês (mesma regra do dashboard)
  const rd = resumoDoMes(txsRes.data ?? [], { ano, mes });
  const gastoPorCategoria = rd.porCategoria; // despesas do mês por categoria
  const gastoTotalMes = rd.totalDespesas;    // total de despesas do mês (todas as categorias)

  const resumo = resumoOrcamento({ rendaCentavos: renda, budgets, gastoPorCategoria });
  const pctPorCat = new Map(budgets.map((b) => [b.categoria_id, b.percentual]));
  const itemPorCat = new Map(resumo.itens.map((i) => [i.categoria_id, i]));

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[var(--text)]">Orçamento</h1>
        <Link href="/planejamento?aba=fixos" className="text-sm text-[var(--accent)]">Gastos fixos</Link>
      </header>

      <RendaCasal membros={membros} />

      {/* resumo do mês: alocado x reserva, orçado x gasto */}
      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div><div className="text-xs text-[var(--muted)]">Alocado</div><div className="mono text-lg font-semibold" style={resumo.totalPercentual > 100 ? { color: "var(--alerta)" } : undefined}>{resumo.totalPercentual}%</div></div>
          <div><div className="text-xs text-[var(--muted)]">Reserva</div><div className="text-lg"><Money centavos={resumo.reservaCentavos} sinal /></div></div>
          <div><div className="text-xs text-[var(--muted)]">Orçado</div><div className="text-lg"><Money centavos={resumo.totalOrcadoCentavos} /></div></div>
          <div><div className="text-xs text-[var(--muted)]">Gasto no mês</div><div className="text-lg"><Money centavos={gastoTotalMes} /></div></div>
        </div>
        {resumo.totalPercentual > 100 && (
          <p style={{ color: "var(--alerta)" }}>Você alocou {resumo.totalPercentual}% da renda — acima de 100%.</p>
        )}
      </Card>

      {/* categorias */}
      <div className="flex flex-col gap-3">
        {cats.map((c) => {
          const pct = pctPorCat.get(c.id) ?? 0;
          const item = itemPorCat.get(c.id);
          const limite = item?.limiteCentavos ?? 0;
          const gasto = gastoPorCategoria[c.id] ?? 0;
          const usado = item?.pctUsado ?? 0;
          const cor = usado > 100 ? "var(--negativo)" : usado > 85 ? "var(--alerta)" : c.cor;
          return (
            <Card key={c.id}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <Link href={`/lancamentos?categoria=${c.id}`}
                  className="flex min-w-0 items-center gap-2 break-words font-medium text-[var(--text)] hover:text-[var(--accent)]">
                  <CategoriaPonto cor={c.cor} />{c.nome}
                </Link>
                <PercentualEditor categoriaId={c.id} percentual={pct} />
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, usado)}%`, background: cor }} />
              </div>
              <div className="mt-2 flex justify-between text-sm text-[var(--muted)]">
                <span>Gasto <Money centavos={gasto} tamanho="sm" /> de <Money centavos={limite} tamanho="sm" /></span>
                <span>{limite > 0 ? <>Resta <Money centavos={limite - gasto} tamanho="sm" sinal /></> : "sem limite"}</span>
              </div>
              <div className="mt-3">
                <EditarCategoria categoriaId={c.id} nome={c.nome} cor={c.cor} />
              </div>
            </Card>
          );
        })}
      </div>

      <AddCategoriaForm />
    </main>
  );
}
