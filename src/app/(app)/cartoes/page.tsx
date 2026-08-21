import { createServerSupabase } from "@/lib/supabase/server";
import { limiteDisponivel } from "@/lib/financeiro/derivados";
import { Money } from "@/components/ui/Money";
import { Card } from "@/components/ui/Card";

export default async function CartoesPage() {
  const supabase = await createServerSupabase();
  const { data: cards } = await supabase.from("cards").select("*").order("nome");
  const { data: txs } = await supabase
    .from("transactions").select("card_id, valor_centavos, paga").not("card_id", "is", null);

  const linhas = (cards ?? []).map((card) => {
    const emAberto = (txs ?? []).filter((t) => t.card_id === card.id && !t.paga);
    const disponivel = limiteDisponivel(card.limite_centavos, emAberto);
    const usado = card.limite_centavos - disponivel;
    const pct = card.limite_centavos > 0 ? Math.min(100, (usado / card.limite_centavos) * 100) : 0;
    return { card, usado, disponivel, pct };
  });

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Cartões</h1>
        <p className="text-sm text-[var(--muted)]">
          Limite usado e disponível em cada cartão, considerando as parcelas em aberto.
        </p>
      </header>

      {linhas.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">
            Nenhum cartão cadastrado ainda. Adicione um cartão para acompanhar o limite disponível.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {linhas.map(({ card, usado, disponivel, pct }) => (
            <Card key={card.id}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-[var(--text)]">{card.nome}</span>
                  {card.titular && (
                    <span className="text-xs text-[var(--muted)]">{card.titular}</span>
                  )}
                </div>
                <span className="text-xs text-[var(--muted)]">
                  fecha dia {card.dia_fechamento} · vence dia {card.dia_vencimento}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--borda)]">
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{
                    width: `${pct}%`,
                    background: pct > 85 ? "var(--negativo)" : "var(--accent)",
                  }}
                />
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-[var(--muted)]">
                  Usado: <Money centavos={usado} />
                </span>
                <span className="text-[var(--muted)]">
                  Disponível: <Money centavos={disponivel} />
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
