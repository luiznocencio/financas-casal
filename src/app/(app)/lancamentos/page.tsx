import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { Money } from "@/components/ui/Money";
import { Card } from "@/components/ui/Card";

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
  const { data: txs, error } = await q;
  if (error) throw new Error(`Falha ao carregar o extrato: ${error.message}`);

  const filtrosAtivos = [
    sp.pessoa ? { chave: "pessoa", rotulo: `Pessoa: ${sp.pessoa}` } : null,
    sp.card ? { chave: "card", rotulo: "Cartão selecionado" } : null,
    sp.categoria ? { chave: "categoria", rotulo: "Categoria selecionada" } : null,
  ].filter((f): f is { chave: string; rotulo: string } => f !== null);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Extrato</h1>
        <p className="text-sm text-[var(--muted)]">
          Últimos lançamentos do casal, do mais recente para o mais antigo.
        </p>
      </header>

      {filtrosAtivos.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {filtrosAtivos.map((f) => (
            <span
              key={f.chave}
              className="rounded-full border border-[var(--borda)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--muted)]"
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
        <ul className="flex flex-col gap-0">
          {(txs ?? []).map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-3 border-b border-[var(--borda)] py-3 last:border-b-0"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-[var(--text)]">{t.descricao ?? "(sem descrição)"}</span>
                <span className="text-xs text-[var(--muted)]">
                  {t.data_compra} · {t.pessoa}
                  {t.total_parcelas > 1 ? ` · ${t.parcela_n}/${t.total_parcelas}` : ""}
                </span>
              </div>
              <Money centavos={t.tipo === "receita" ? t.valor_centavos : -t.valor_centavos} sinal />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
