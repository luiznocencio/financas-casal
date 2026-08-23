import { createServerSupabase } from "@/lib/supabase/server";
import { calcularMeta, totaisMetas } from "@/lib/financeiro/metas";
import { Money } from "@/components/ui/Money";
import { Card } from "@/components/ui/Card";
import { NovaMetaForm } from "@/components/metas/NovaMetaForm";
import { AporteForm } from "@/components/metas/AporteForm";
import { RemoverMeta } from "@/components/metas/RemoverMeta";

export default async function MetasPage() {
  const supabase = await createServerSupabase();
  const [goalsRes, aportesRes] = await Promise.all([
    supabase.from("goals").select("id, nome, valor_alvo_centavos, data_alvo").order("created_at"),
    supabase.from("goal_contributions").select("goal_id, valor_centavos"),
  ]);
  const erro = goalsRes.error ?? aportesRes.error;
  if (erro) throw new Error(`Falha ao carregar as metas: ${erro.message}`);

  const goals = goalsRes.data ?? [];
  const aportesPorGoal: Record<string, { valor_centavos: number }[]> = {};
  for (const a of aportesRes.data ?? []) {
    (aportesPorGoal[a.goal_id] ??= []).push({ valor_centavos: a.valor_centavos });
  }
  const totais = totaisMetas(goals, aportesPorGoal);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-[var(--text)]">Metas</h1>
          <p className="text-sm text-[var(--muted)]">
            Guardado <Money centavos={totais.totalGuardadoCentavos} tamanho="sm" /> de <Money centavos={totais.totalAlvoCentavos} tamanho="sm" />
          </p>
        </div>
        <NovaMetaForm />
      </header>

      {goals.length === 0 ? (
        <Card><p className="text-sm text-[var(--muted)]">Nenhuma meta ainda. Crie a primeira (ex.: reserva de emergência, viagem).</p></Card>
      ) : (
        <div className="flex flex-col gap-3">
          {goals.map((g) => {
            const m = calcularMeta(g.valor_alvo_centavos, aportesPorGoal[g.id] ?? []);
            const cor = m.concluida ? "var(--positivo)" : "var(--accent)";
            return (
              <Card key={g.id}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-[var(--text)]">{g.nome}{m.concluida && <span className="ml-2 text-xs text-[var(--positivo)]">concluída</span>}</span>
                    {g.data_alvo && <span className="text-xs text-[var(--muted)]">até {g.data_alvo}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <AporteForm goalId={g.id} />
                    <RemoverMeta goalId={g.id} />
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div className="h-full rounded-full" style={{ width: `${m.pctConcluido}%`, background: cor }} />
                </div>
                <div className="mt-2 flex justify-between text-sm text-[var(--muted)]">
                  <span><Money centavos={m.guardadoCentavos} tamanho="sm" /> de <Money centavos={g.valor_alvo_centavos} tamanho="sm" /></span>
                  <span>{m.concluida ? "🎉" : <>Faltam <Money centavos={m.restanteCentavos} tamanho="sm" /></>}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
