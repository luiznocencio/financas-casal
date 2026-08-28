import { createServerSupabase } from "@/lib/supabase/server";
import { saldoConta } from "@/lib/financeiro/derivados";
import { Money } from "@/components/ui/Money";
import { Card } from "@/components/ui/Card";
import { AddContaForm } from "@/components/contas/AddContaForm";
import { EditarConta } from "@/components/contas/EditarConta";

const ROTULO_TIPO: Record<string, string> = {
  corrente: "Conta corrente",
  dinheiro: "Dinheiro",
  poupanca: "Poupança",
};

export default async function ContasPage() {
  const supabase = await createServerSupabase();
  const { data: contas } = await supabase.from("accounts").select("*").order("nome");
  const { data: txs } = await supabase
    .from("transactions").select("account_id, tipo, valor_centavos").not("account_id", "is", null);

  const linhas = (contas ?? []).map((c) => {
    const movimentos = (txs ?? []).filter((t) => t.account_id === c.id);
    return { conta: c, saldo: saldoConta(c.saldo_inicial_centavos, movimentos) };
  });

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Contas</h1>
        <p className="text-sm text-[var(--muted)]">
          Saldo atual de cada conta do casal, já considerando as movimentações lançadas.
        </p>
      </header>

      <AddContaForm />

      {linhas.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">
            Nenhuma conta cadastrada ainda. Crie a primeira conta para começar a acompanhar o saldo.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
          {linhas.map(({ conta, saldo }) => (
            <Card key={conta.id} className="transition-colors hover:border-[var(--accent)]">
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="break-words font-medium text-[var(--text)]">{conta.nome}</span>
                    <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
                      {ROTULO_TIPO[conta.tipo] ?? conta.tipo}
                    </span>
                    {conta.titular && (
                      <span className="mt-0.5 inline-flex w-fit items-center rounded-full bg-[var(--accent-weak)] px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                        {conta.titular}
                      </span>
                    )}
                  </div>
                  <Money centavos={saldo} sinal tamanho="lg" />
                </div>
                <EditarConta conta={conta} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
