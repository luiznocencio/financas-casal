import { createServerSupabase } from "@/lib/supabase/server";
import { limiteDisponivel } from "@/lib/financeiro/derivados";
import { agruparFaturas } from "@/lib/financeiro/faturas";
import { Money } from "@/components/ui/Money";
import { Card } from "@/components/ui/Card";
import { FaturaBotao } from "@/components/cartoes/FaturaBotao";
import { CreditCard as CreditCardIcon, Receipt } from "@phosphor-icons/react/dist/ssr";

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

export default async function CartoesPage() {
  const supabase = await createServerSupabase();
  const [cardsRes, txsRes, invoicesRes] = await Promise.all([
    supabase.from("cards").select("*").order("nome"),
    supabase.from("transactions")
      .select("card_id, invoice_id, valor_centavos, paga").not("card_id", "is", null),
    supabase.from("invoices").select("id, card_id, competencia_ano, competencia_mes, status"),
  ]);
  const erro = cardsRes.error ?? txsRes.error ?? invoicesRes.error;
  if (erro) throw new Error(`Falha ao carregar os cartões: ${erro.message}`);
  const cards = cardsRes.data ?? [];
  const txs = txsRes.data ?? [];
  const invoices = invoicesRes.data ?? [];

  const linhas = cards.map((card) => {
    const txsCartao = txs.filter((t) => t.card_id === card.id);
    const emAberto = txsCartao.filter((t) => !t.paga);
    const disponivel = limiteDisponivel(card.limite_centavos, emAberto);
    const usado = card.limite_centavos - disponivel;
    const pct = card.limite_centavos > 0 ? Math.min(100, (usado / card.limite_centavos) * 100) : 0;
    const faturas = agruparFaturas(
      invoices.filter((inv) => inv.card_id === card.id),
      txsCartao,
    ).filter((f) => f.totalCentavos > 0);
    return { card, usado, disponivel, pct, faturas };
  });

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Cartões</h1>
        <p className="text-sm text-[var(--muted)]">
          Limite usado e disponível, e as faturas por mês. Marque uma fatura como paga para liberar o limite.
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
          {linhas.map(({ card, usado, disponivel, pct, faturas }) => (
            <Card key={card.id}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-1.5 font-semibold text-[var(--text)]">
                    <CreditCardIcon size={16} />
                    {card.nome}
                  </span>
                  {card.titular && (
                    <span className="text-xs text-[var(--muted)]">{card.titular}</span>
                  )}
                </div>
                <span className="text-xs text-[var(--muted)]">
                  fecha dia {card.dia_fechamento} · vence dia {card.dia_vencimento}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{
                    width: `${pct}%`,
                    background: pct > 85 ? "var(--alerta)" : "var(--accent)",
                  }}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-[var(--muted)]">Usado</span>
                  <Money centavos={usado} />
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-xs text-[var(--muted)]">Disponível</span>
                  <Money centavos={disponivel} tamanho="lg" />
                </div>
              </div>

              {faturas.length > 0 && (
                <div className="mt-4 flex flex-col gap-2 border-t border-[var(--border)] pt-3">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]">
                    <Receipt size={14} /> Faturas
                  </span>
                  {faturas.map((f) => (
                    <div key={f.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-[var(--text)]">
                        {MESES[f.mes - 1]}/{f.ano}
                        {f.paga && (
                          <span className="ml-2 text-xs text-[var(--positivo)]">paga</span>
                        )}
                      </span>
                      <span className="flex items-center gap-3">
                        <Money centavos={f.totalCentavos} />
                        <FaturaBotao invoiceId={f.id} paga={f.paga} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
