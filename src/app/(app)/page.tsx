import { createServerSupabase } from "@/lib/supabase/server";
import { saldoConta, limiteDisponivel } from "@/lib/financeiro/derivados";
import { resumoDoMes } from "@/lib/financeiro/agregacoes";
import { Money } from "@/components/ui/Money";
import { Card } from "@/components/ui/Card";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export default async function Dashboard() {
  const supabase = await createServerSupabase();
  const agora = new Date();
  const ref = { ano: agora.getFullYear(), mes: agora.getMonth() + 1 };

  const [{ data: contas }, { data: cards }, { data: txs }, { data: cats }] = await Promise.all([
    supabase.from("accounts").select("*"),
    supabase.from("cards").select("*"),
    supabase.from("transactions").select("*"),
    supabase.from("categories").select("id, nome"),
  ]);

  const saldoTotal = (contas ?? []).reduce((s, c) => {
    const mov = (txs ?? []).filter((t) => t.account_id === c.id);
    return s + saldoConta(c.saldo_inicial_centavos, mov);
  }, 0);

  const comprometido = (cards ?? []).reduce((s, card) => {
    const emAberto = (txs ?? []).filter((t) => t.card_id === card.id && !t.paga);
    return s + (card.limite_centavos - limiteDisponivel(card.limite_centavos, emAberto));
  }, 0);

  const resumo = resumoDoMes(txs ?? [], ref);
  const nomeCat = (id: string) => (cats ?? []).find((c) => c.id === id)?.nome ?? "Outros";
  const porPessoa = Object.entries(resumo.porPessoa).sort((a, b) => b[1] - a[1]);
  const topCategorias = Object.entries(resumo.porCategoria).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maiorPessoa = porPessoa.length ? porPessoa[0][1] : 0;
  const maiorCategoria = topCategorias.length ? topCategorias[0][1] : 0;

  const stats = [
    { label: "Saldo em contas", valor: saldoTotal, sinal: true },
    { label: "Faturas abertas", valor: comprometido, sinal: false },
    { label: "Despesas do mês", valor: resumo.totalDespesas, sinal: false },
    { label: "Receitas do mês", valor: resumo.totalReceitas, sinal: false },
  ];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Início</h1>
        <p className="text-sm text-[var(--muted)]">
          Resumo de {MESES[ref.mes - 1]} de {ref.ano} — saldo, faturas e para onde foi o dinheiro.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-wide text-[var(--muted)]">{s.label}</span>
              <span className="text-xl font-semibold">
                <Money centavos={s.valor} sinal={s.sinal} />
              </span>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-medium text-[var(--text)]">Quem gastou</h3>
          {porPessoa.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Nenhuma despesa lançada neste mês ainda.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {porPessoa.map(([pessoa, valor]) => (
                <div key={pessoa} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text)]">{pessoa}</span>
                    <Money centavos={valor} />
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--borda)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)]"
                      style={{ width: `${maiorPessoa > 0 ? (valor / maiorPessoa) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="mb-3 font-medium text-[var(--text)]">Top categorias</h3>
          {topCategorias.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Nenhuma categoria com gasto neste mês ainda.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {topCategorias.map(([id, valor]) => (
                <div key={id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text)]">{nomeCat(id)}</span>
                    <Money centavos={valor} />
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--borda)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)]"
                      style={{ width: `${maiorCategoria > 0 ? (valor / maiorCategoria) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
