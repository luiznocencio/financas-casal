import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { limiteDisponivel } from "@/lib/financeiro/derivados";
import { agruparFaturas } from "@/lib/financeiro/faturas";
import { corDaPessoa } from "@/lib/ui/pessoas";
import { Money } from "@/components/ui/Money";
import { Card } from "@/components/ui/Card";
import { FaturaBotao } from "@/components/cartoes/FaturaBotao";
import { AddCartaoForm } from "@/components/cartoes/AddCartaoForm";
import { EditarCartao } from "@/components/cartoes/EditarCartao";
import { AtivarNotificacoes } from "@/components/pwa/AtivarNotificacoes";
import { CreditCard as CreditCardIcon, Receipt } from "@phosphor-icons/react/dist/ssr";

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

export default async function CartoesPage() {
  const supabase = await createServerSupabase();
  const [cardsRes, txsRes, invoicesRes, membrosRes] = await Promise.all([
    supabase.from("cards").select("*").order("nome"),
    supabase.from("transactions")
      .select("card_id, invoice_id, valor_centavos, paga").not("card_id", "is", null),
    supabase.from("invoices").select("id, card_id, competencia_ano, competencia_mes, status"),
    supabase.from("members").select("nome"),
  ]);
  const erro = cardsRes.error ?? txsRes.error ?? invoicesRes.error ?? membrosRes.error;
  if (erro) throw new Error(`Falha ao carregar os cartões: ${erro.message}`);
  const cards = cardsRes.data ?? [];
  const membros = (membrosRes.data ?? []).map((m) => m.nome);
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
    return { card, usado, pct, faturas };
  });

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Cartões</h1>
        <p className="text-sm text-[var(--muted)]">
          Quanto você já gastou em cada cartão e as faturas por mês. Marque uma fatura como paga quando quitá-la.
        </p>
      </header>

      <AtivarNotificacoes />

      <AddCartaoForm />

      {linhas.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">
            Nenhum cartão cadastrado ainda. Adicione um cartão para acompanhar o limite disponível.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {linhas.map(({ card, usado, pct, faturas }) => (
            <Card key={card.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-1.5 break-words font-semibold text-[var(--text)]">
                    <CreditCardIcon size={16} />
                    {card.nome}
                  </span>
                  {card.titular && (
                    <span className="mt-0.5 inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium text-[var(--text)]"
                      style={{ background: `color-mix(in srgb, ${corDaPessoa(card.titular, membros)} 16%, transparent)` }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: corDaPessoa(card.titular, membros) }} />
                      {card.titular}
                    </span>
                  )}
                </div>
                <span className="shrink-0 text-xs text-[var(--muted)]">
                  fecha dia {card.dia_fechamento} · vence dia {card.dia_vencimento}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[var(--muted)]">Gasto neste cartão</span>
                <Money centavos={usado} tamanho="lg" />
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div className="h-full rounded-full transition-[width]"
                    style={{ width: `${pct}%`, background: pct > 85 ? "var(--alerta)" : "var(--accent)" }} />
                </div>
              </div>

              {faturas.length > 0 && (
                <div className="mt-4 flex flex-col gap-2 border-t border-[var(--border)] pt-3">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]">
                    <Receipt size={14} /> Faturas
                  </span>
                  {faturas.map((f) => (
                    <div key={f.id} className="flex items-center justify-between gap-3 text-sm">
                      <Link href={`/lancamentos?invoice=${f.id}`}
                        className="text-[var(--text)] hover:text-[var(--accent)] hover:underline">
                        {MESES[f.mes - 1]}/{f.ano}
                        {f.paga && (
                          <span className="ml-2 text-xs text-[var(--positivo)]">paga</span>
                        )}
                      </Link>
                      <span className="flex items-center gap-3">
                        <Money centavos={f.totalCentavos} />
                        <FaturaBotao invoiceId={f.id} paga={f.paga} />
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4">
                <EditarCartao card={card} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
