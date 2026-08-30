import { createServerSupabase } from "@/lib/supabase/server";
import { Money } from "@/components/ui/Money";
import { Card } from "@/components/ui/Card";
import { AddReceitaAgendada } from "@/components/receitas/AddReceitaAgendada";
import { ReceitaAcoes } from "@/components/receitas/ReceitaAcoes";
import type { ReceitaAgendada } from "@/lib/db/tipos";

export async function SecaoAReceber() {
  const supabase = await createServerSupabase();
  const [raRes, contasRes, membrosRes] = await Promise.all([
    supabase.from("receitas_agendadas").select("*").eq("ativo", true).order("data_prevista"),
    supabase.from("accounts").select("id, nome, titular").order("nome"),
    supabase.from("members").select("nome"),
  ]);
  const erro = raRes.error ?? contasRes.error ?? membrosRes.error;
  if (erro) throw new Error(`Falha ao carregar as receitas a receber: ${erro.message}`);

  const receitas = (raRes.data ?? []) as ReceitaAgendada[];
  const contas = contasRes.data ?? [];
  const membros = (membrosRes.data ?? []).map((m) => m.nome);
  const nomeConta = new Map(contas.map((c) => [c.id, c.nome]));
  const totalAReceber = receitas.reduce((s, r) => s + r.valor_centavos, 0);
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-[var(--muted)]">
        O que você tem a receber (salário, freela, reembolso): quando, pra qual conta e com qual recorrência.
        Total previsto: <Money centavos={totalAReceber} tamanho="sm" />. Ao marcar “Recebi”, vira uma receita na conta.
      </p>

      <AddReceitaAgendada contas={contas} membros={membros} />

      {receitas.length === 0 ? (
        <Card><p className="text-sm text-[var(--muted)]">Nada agendado ainda. Agende o que você tem a receber (ex.: salário, um freela).</p></Card>
      ) : (
        <Card>
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {receitas.map((r) => {
              const data = new Date(r.data_prevista + "T12:00:00").toLocaleDateString("pt-BR");
              const atrasada = r.data_prevista < hoje;
              return (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="break-words font-medium text-[var(--text)]">{r.descricao}</span>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                      <span style={atrasada ? { color: "var(--alerta)" } : undefined}>
                        {atrasada ? "venceu " : "prev. "}{data}
                      </span>
                      <span>· {nomeConta.get(r.account_id) ?? "conta"}</span>
                      <span>· {r.pessoa}</span>
                      {r.recorrencia === "mensal" && (
                        <span className="rounded-full px-2 py-0.5 text-[0.7rem] font-medium"
                          style={{ background: "var(--accent-weak)", color: "var(--accent)" }}>mensal</span>
                      )}
                      {r.data_fim && <span>· até {new Date(r.data_fim + "T12:00:00").toLocaleDateString("pt-BR")}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Money centavos={r.valor_centavos} sinal />
                    <ReceitaAcoes id={r.id} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
