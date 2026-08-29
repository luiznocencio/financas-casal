import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { LinhaEditavel } from "@/components/lancamentos/LinhaEditavel";

export default async function Lancamentos({
  searchParams,
}: {
  searchParams: Promise<{ pessoa?: string; card?: string; categoria?: string; invoice?: string }>;
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
  const [txsRes, membrosRes, categoriasRes, cardsRes] = await Promise.all([
    q,
    supabase.from("members").select("nome"),
    supabase.from("categories").select("id, nome, cor"),
    supabase.from("cards").select("id, nome"),
  ]);
  const { data: txs, error } = txsRes;
  const erro = error ?? membrosRes.error ?? categoriasRes.error ?? cardsRes.error;
  if (erro) throw new Error(`Falha ao carregar o extrato: ${erro.message}`);
  const membros = (membrosRes.data ?? []).map((m) => m.nome);
  const categorias = categoriasRes.data ?? [];
  const cartoes = cardsRes.data ?? [];

  const nomeCategoria = categorias.find((c) => c.id === sp.categoria)?.nome;
  const nomeCartao = cartoes.find((c) => c.id === sp.card)?.nome;
  const filtrosAtivos = [
    sp.pessoa ? { chave: "pessoa", rotulo: `Pessoa: ${sp.pessoa}` } : null,
    sp.card ? { chave: "card", rotulo: `Cartão: ${nomeCartao ?? "selecionado"}` } : null,
    sp.categoria ? { chave: "categoria", rotulo: `Categoria: ${nomeCategoria ?? "selecionada"}` } : null,
    sp.invoice ? { chave: "invoice", rotulo: "Fatura selecionada" } : null,
  ].filter((f): f is { chave: string; rotulo: string } => f !== null);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-[var(--text)]">Extrato</h1>
          <div className="flex items-center gap-3">
            <Link href="/a-receber" className="text-sm text-[var(--accent)]">A receber</Link>
            <Link href="/importar" className="text-sm text-[var(--accent)]">Importar</Link>
          </div>
        </div>
        <p className="text-sm text-[var(--muted)]">
          Últimos lançamentos do casal, do mais recente para o mais antigo.
        </p>
      </header>

      {filtrosAtivos.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {filtrosAtivos.map((f) => (
            <span
              key={f.chave}
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{ background: "var(--accent-weak)", color: "var(--accent)" }}
            >
              {f.rotulo}
            </span>
          ))}
          <Link href="/lancamentos" className="text-xs text-[var(--accent)] hover:underline">
            Limpar filtros
          </Link>
        </div>
      )}

      {(txs ?? []).length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">
            Nenhum lançamento encontrado{filtrosAtivos.length > 0 ? " para esse filtro" : ""}.
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
