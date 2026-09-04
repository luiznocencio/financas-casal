import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { LinhaEditavel } from "@/components/lancamentos/LinhaEditavel";
import { FiltrosExtrato } from "@/components/lancamentos/FiltrosExtrato";

export default async function Lancamentos({
  searchParams,
}: {
  searchParams: Promise<{ pessoa?: string; card?: string; categoria?: string; invoice?: string; tipo?: string; origem?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createServerSupabase();

  let q = supabase
    .from("transactions")
    .select("id, descricao, data_compra, pessoa, parcela_n, total_parcelas, tipo, valor_centavos, categoria_id, card_id, account_id, recorrente_id, observacao")
    .order("data_compra", { ascending: false })
    .limit(200);
  if (sp.pessoa) q = q.eq("pessoa", sp.pessoa);
  if (sp.card) q = q.eq("card_id", sp.card);
  if (sp.categoria) q = q.eq("categoria_id", sp.categoria);
  if (sp.invoice) q = q.eq("invoice_id", sp.invoice);
  if (sp.tipo === "despesa" || sp.tipo === "receita") q = q.eq("tipo", sp.tipo);
  if (sp.origem === "cartao") q = q.not("card_id", "is", null);
  if (sp.origem === "pix") q = q.not("account_id", "is", null);
  const [txsRes, membrosRes, categoriasRes, cardsRes] = await Promise.all([
    q,
    supabase.from("members").select("nome"),
    supabase.from("categories").select("id, nome, cor, parent_id, tipo"),
    supabase.from("cards").select("id, nome"),
  ]);
  const { data: txs, error } = txsRes;
  const erro = error ?? membrosRes.error ?? categoriasRes.error ?? cardsRes.error;
  if (erro) throw new Error(`Falha ao carregar o extrato: ${erro.message}`);
  const membros = (membrosRes.data ?? []).map((m) => m.nome);
  const categorias = categoriasRes.data ?? [];
  const cartoes = cardsRes.data ?? [];
  const temFiltro = !!(sp.pessoa || sp.card || sp.categoria || sp.invoice || sp.tipo || sp.origem);

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

      {(txs ?? []).length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">
            Nenhum lançamento encontrado{temFiltro ? " para esse filtro" : ""}.
          </p>
        </Card>
      ) : (
        <Card>
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
