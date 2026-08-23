import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { Money } from "@/components/ui/Money";
import { Card } from "@/components/ui/Card";
import { PersonChip } from "@/components/ui/PersonChip";

export default async function Lancamentos({
  searchParams,
}: {
  searchParams: Promise<{ pessoa?: string; card?: string; categoria?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createServerSupabase();

  let q = supabase.from("transactions").select("*").order("data_compra", { ascending: false }).limit(200);
  if (sp.pessoa) q = q.eq("pessoa", sp.pessoa);
  if (sp.card) q = q.eq("card_id", sp.card);
  if (sp.categoria) q = q.eq("categoria_id", sp.categoria);
  const [txsRes, membrosRes] = await Promise.all([
    q,
    supabase.from("members").select("nome"),
  ]);
  const { data: txs, error } = txsRes;
  const erro = error ?? membrosRes.error;
  if (erro) throw new Error(`Falha ao carregar o extrato: ${erro.message}`);
  const membros = (membrosRes.data ?? []).map((m) => m.nome);

  const filtrosAtivos = [
    sp.pessoa ? { chave: "pessoa", rotulo: `Pessoa: ${sp.pessoa}` } : null,
    sp.card ? { chave: "card", rotulo: "Cartão selecionado" } : null,
    sp.categoria ? { chave: "categoria", rotulo: "Categoria selecionada" } : null,
  ].filter((f): f is { chave: string; rotulo: string } => f !== null);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-[var(--text)]">Extrato</h1>
          <Link href="/importar" className="text-sm text-[var(--accent)]">Importar</Link>
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
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-3 last:border-b-0"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-[var(--text)]">{t.descricao ?? "(sem descrição)"}</span>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                    <span>{t.data_compra}</span>
                    <PersonChip nome={t.pessoa} membros={membros} />
                    {t.total_parcelas > 1 && (
                      <span>{t.parcela_n}/{t.total_parcelas}</span>
                    )}
                  </div>
                </div>
                <Money centavos={t.tipo === "receita" ? t.valor_centavos : -t.valor_centavos} sinal />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}
