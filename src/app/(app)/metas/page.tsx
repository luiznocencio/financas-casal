import Image from "next/image";
import { createServerSupabase } from "@/lib/supabase/server";
import { calcularMeta, totaisMetas } from "@/lib/financeiro/metas";
import { imagemDaMeta } from "@/lib/ui/metaImagem";
import { Money } from "@/components/ui/Money";
import { Card } from "@/components/ui/Card";
import { NovaMetaForm } from "@/components/metas/NovaMetaForm";
import { AporteForm } from "@/components/metas/AporteForm";
import { RemoverMeta } from "@/components/metas/RemoverMeta";
import { Confetti } from "@phosphor-icons/react/dist/ssr";

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
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
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
        <div className="grid gap-4 sm:grid-cols-2">
          {goals.map((g) => {
            const m = calcularMeta(g.valor_alvo_centavos, aportesPorGoal[g.id] ?? []);
            const cor = m.concluida ? "var(--positivo)" : "var(--accent)";
            return (
              <div key={g.id} className="flex flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)]">
                <div className="relative h-28 w-full sm:h-32">
                  <Image src={imagemDaMeta(g.nome)} alt="" fill sizes="(max-width: 640px) 100vw, 420px" className="object-cover" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,.62), rgba(0,0,0,0) 65%)" }} />
                  <div className="absolute inset-x-3 bottom-2 flex items-end justify-between gap-2">
                    <span className="break-words font-semibold text-white" style={{ textShadow: "0 1px 3px rgba(0,0,0,.5)" }}>{g.nome}</span>
                    {m.concluida && <span className="shrink-0 rounded-full bg-[var(--positivo)] px-2 py-0.5 text-xs font-medium text-white">concluída</span>}
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  {g.data_alvo && <span className="text-xs text-[var(--muted)]">até {new Date(g.data_alvo + "T12:00:00").toLocaleDateString("pt-BR")}</span>}
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                    <div className="h-full rounded-full" style={{ width: `${m.pctConcluido}%`, background: cor }} />
                  </div>
                  <div className="flex justify-between text-sm text-[var(--muted)]">
                    <span><Money centavos={m.guardadoCentavos} tamanho="sm" /> de <Money centavos={g.valor_alvo_centavos} tamanho="sm" /></span>
                    <span>{m.concluida ? <Confetti size={16} weight="fill" color="var(--positivo)" /> : <>Faltam <Money centavos={m.restanteCentavos} tamanho="sm" /></>}</span>
                  </div>
                  <div className="mt-auto flex items-center gap-3 pt-1">
                    <AporteForm goalId={g.id} />
                    <RemoverMeta goalId={g.id} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
