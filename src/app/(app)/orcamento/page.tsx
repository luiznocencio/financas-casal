import { createServerSupabase } from "@/lib/supabase/server";
import { resumoOrcamento } from "@/lib/financeiro/orcamento";
import { orcamentoDoMes, estadoCategoria } from "@/lib/financeiro/projecao";
import { partesNoFuso } from "@/lib/financeiro/fechamento";
import { Money } from "@/components/ui/Money";
import { Card } from "@/components/ui/Card";
import Link from "next/link";
import { RendaCasal } from "@/components/orcamento/RendaCasal";
import { PercentualEditor } from "@/components/orcamento/PercentualEditor";
import { EditarCategoria } from "@/components/orcamento/EditarCategoria";
import { AddCategoriaForm } from "@/components/orcamento/AddCategoriaForm";
import { AddSubcategoria } from "@/components/orcamento/AddSubcategoria";
import { CategoriaPonto } from "@/components/ui/CategoriaTag";
import { BarraOrcamento, SeloOrcamento } from "@/components/orcamento/BarraOrcamento";

export default async function OrcamentoPage() {
  const supabase = await createServerSupabase();
  const { ano, mes } = partesNoFuso(new Date(), "America/Sao_Paulo");

  const [membrosRes, catsRes, budgetsRes, txsRes, contasRes, invoicesRes, fixosRes, contasPagarRes] = await Promise.all([
    supabase.from("members").select("user_id, nome, renda_mensal_centavos, ajuda_custo_centavos, salario_account_id, ajuda_custo_account_id").order("papel"),
    supabase.from("categories").select("id, nome, cor, parent_id").eq("tipo", "despesa").order("nome"),
    supabase.from("budgets").select("categoria_id, valor_centavos"),
    supabase.from("transactions").select("categoria_id, tipo, pessoa, valor_centavos, data_compra, card_id, account_id, invoice_id, total_parcelas, recorrente_id, conta_pagar_id, descricao"),
    supabase.from("accounts").select("id, nome, titular").order("nome"),
    supabase.from("invoices").select("id, competencia_ano, competencia_mes"),
    supabase.from("recorrentes").select("id, descricao, valor_centavos, categoria_id, dia, card_id, account_id, data_fim, ativo").eq("ativo", true),
    supabase.from("contas_pagar").select("id, descricao, categoria_id, valor_estimado_centavos, dia_vencimento, recorrencia, data_fim, created_at").eq("ativo", true),
  ]);
  const erro = membrosRes.error ?? catsRes.error ?? budgetsRes.error ?? txsRes.error ?? contasRes.error ?? invoicesRes.error ?? fixosRes.error ?? contasPagarRes.error;
  if (erro) throw new Error(`Falha ao carregar o orçamento: ${erro.message}`);

  const membros = membrosRes.data ?? [];
  const contasRenda = contasRes.data ?? [];
  const renda = membros.reduce((s, m) => s + (m.renda_mensal_centavos ?? 0) + (m.ajuda_custo_centavos ?? 0), 0);
  const cats = catsRes.data ?? [];
  const budgets = budgetsRes.data ?? [];

  // subcategorias: o orçamento fica na mãe; o gasto do filho soma na mãe
  const maes = cats.filter((c) => !c.parent_id);
  const filhosPorMae = new Map<string, typeof cats>();
  for (const c of cats) if (c.parent_id) (filhosPorMae.get(c.parent_id) ?? filhosPorMae.set(c.parent_id, []).get(c.parent_id)!).push(c);

  // CONSUMO = mês da compra (parcela pela competência) + PROJEÇÃO do que ainda vai
  // cair no mês (fixos não lançados, contas pendentes). Mesma regra da Home e dos avisos.
  const orc = orcamentoDoMes({ ano, mes }, {
    cats, budgets, txs: txsRes.data ?? [], invoices: invoicesRes.data ?? [],
    fixos: fixosRes.data ?? [], contas: contasPagarRes.data ?? [],
  });
  const gastoPorCategoria = orc.gastoPorCategoria; // filho fica no filho
  const gastoRollup = orc.gastoRollup;             // filho soma na mãe
  const gastoTotalMes = orc.totalGasto;
  const projPorCat = new Map(orc.itens.map((i) => [i.categoria_id, i]));
  const catPorId = new Map(cats.map((c) => [c.id, c]));

  const resumo = resumoOrcamento({ rendaCentavos: renda, budgets, gastoPorCategoria: gastoRollup });
  const valorPorCat = new Map(budgets.map((b) => [b.categoria_id, b.valor_centavos]));
  const itemPorCat = new Map(resumo.itens.map((i) => [i.categoria_id, i]));
  // ao filtrar uma categoria no extrato, leva o mês corrente (competência) junto
  const mesParam = `${ano}-${String(mes).padStart(2, "0")}`;
  const estadoTotal = estadoCategoria(orc.totalOrcado, orc.totalGastoOrcado, orc.totalProjetadoOrcado - orc.totalGastoOrcado);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[var(--text)]">Orçamento</h1>
        <Link href="/planejamento?aba=fixos" className="text-sm text-[var(--accent)]">Gastos fixos</Link>
      </header>

      <RendaCasal membros={membros} contas={contasRenda} />

      {/* resumo do mês: alocado x reserva, orçado x gasto */}
      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div><div className="text-xs text-[var(--muted)]">Renda</div><div className="text-lg"><Money centavos={renda} /></div></div>
          <div><div className="text-xs text-[var(--muted)]">Orçado</div><div className="text-lg"><Money centavos={resumo.totalOrcadoCentavos} /></div></div>
          <div><div className="text-xs text-[var(--muted)]">Reserva</div><div className="text-lg"><Money centavos={resumo.reservaCentavos} sinal /></div></div>
          <div><div className="text-xs text-[var(--muted)]">Gasto no mês</div><div className="text-lg"><Money centavos={gastoTotalMes} /></div></div>
        </div>
        {resumo.reservaCentavos < 0 && (
          <p style={{ color: "var(--alerta)" }}>Você orçou <Money centavos={resumo.totalOrcadoCentavos} tamanho="sm" /> — acima da renda de <Money centavos={renda} tamanho="sm" />.</p>
        )}
        {orc.totalOrcado > 0 && (
          <div className="mt-4 border-t border-[var(--border)] pt-3">
            <div className="mb-2 flex items-center justify-between gap-2 text-sm">
              <span className="font-medium text-[var(--text)]">Orçamento total</span>
              <SeloOrcamento {...estadoTotal} />
            </div>
            <BarraOrcamento gastoCentavos={orc.totalGastoOrcado} limiteCentavos={orc.totalOrcado}
              aCairCentavos={orc.totalProjetadoOrcado - orc.totalGastoOrcado} cor="var(--accent)" />
          </div>
        )}
      </Card>

      {(orc.semOrcamento.length > 0 || orc.semCategoria > 0) && (
        <Card>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <h3 className="font-medium text-[var(--text)]">Gastos sem orçamento</h3>
            <Money centavos={orc.semOrcamento.reduce((s, i) => s + i.gasto, 0) + orc.semCategoria} tamanho="sm" />
          </div>
          <p className="mb-3 text-xs text-[var(--muted)]">Gasto neste mês em categorias sem limite definido — ficam fora da conta do orçamento.</p>
          <div className="flex flex-col gap-1.5 text-sm">
            {orc.semOrcamento.map((i) => {
              const c = catPorId.get(i.categoria_id);
              return (
                <Link key={i.categoria_id} href={`/lancamentos?categoria=${i.categoria_id}&mes=${mesParam}`}
                  className="flex items-center justify-between gap-2 text-[var(--text)] hover:text-[var(--accent)]">
                  <span className="flex min-w-0 items-center gap-2"><CategoriaPonto cor={c?.cor ?? "#6b7280"} />{c?.nome ?? "Outros"}</span>
                  <Money centavos={i.gasto} tamanho="sm" />
                </Link>
              );
            })}
            {orc.semCategoria > 0 && (
              <div className="flex items-center justify-between gap-2 text-[var(--muted)]">
                <span className="flex items-center gap-2"><CategoriaPonto cor="#6b7280" />Sem categoria</span>
                <Money centavos={orc.semCategoria} tamanho="sm" />
              </div>
            )}
          </div>
        </Card>
      )}

      {/* categorias (mães; o gasto dos filhos soma aqui) */}
      <div className="flex flex-col gap-3">
        {maes.map((c) => {
          const item = itemPorCat.get(c.id);
          const limite = item?.limiteCentavos ?? 0;
          const gasto = gastoRollup[c.id] ?? 0;
          const proj = projPorCat.get(c.id);
          const aCair = orc.aCairRollup[c.id] ?? 0;
          const filhos = filhosPorMae.get(c.id) ?? [];
          return (
            <Card key={c.id}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <Link href={`/lancamentos?categoria=${c.id}&mes=${mesParam}`}
                  className="flex min-w-0 items-center gap-2 break-words font-medium text-[var(--text)] hover:text-[var(--accent)]">
                  <CategoriaPonto cor={c.cor} />{c.nome}
                </Link>
                {proj && <SeloOrcamento estado={proj.estado} excesso={proj.excesso} />}
                <PercentualEditor categoriaId={c.id} valorCentavos={valorPorCat.get(c.id) ?? 0} />
              </div>
              <BarraOrcamento gastoCentavos={gasto} limiteCentavos={limite} cor={c.cor} aCairCentavos={aCair} />

              {filhos.length > 0 && (
                <div className="mt-3 flex flex-col gap-1.5 border-t border-[var(--border)] pt-3">
                  {filhos.map((f) => (
                    <div key={f.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--muted)]">
                      <Link href={`/lancamentos?categoria=${f.id}&mes=${mesParam}`}
                        className="flex min-w-0 flex-1 items-center gap-2 break-words hover:text-[var(--accent)]">
                        <CategoriaPonto cor={f.cor} />{f.nome}
                      </Link>
                      <Money centavos={gastoPorCategoria[f.id] ?? 0} tamanho="sm" />
                      <EditarCategoria categoriaId={f.id} nome={f.nome} cor={f.cor} />
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <EditarCategoria categoriaId={c.id} nome={c.nome} cor={c.cor} />
                <AddSubcategoria maeId={c.id} maeCor={c.cor} />
              </div>
            </Card>
          );
        })}
      </div>

      <AddCategoriaForm maes={maes.map((m) => ({ id: m.id, nome: m.nome }))} />
    </main>
  );
}
