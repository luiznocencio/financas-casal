import { createServerSupabase } from "@/lib/supabase/server";
import { partesNoFuso, ultimoDiaDoMes } from "@/lib/financeiro/fechamento";
import { Money } from "@/components/ui/Money";
import { Card } from "@/components/ui/Card";
import { AddReceitaAgendada } from "@/components/receitas/AddReceitaAgendada";
import { ReceitaAcoes } from "@/components/receitas/ReceitaAcoes";
import { SalarioSync } from "@/components/receitas/SalarioSync";
import type { ReceitaAgendada } from "@/lib/db/tipos";

const pad = (n: number) => String(n).padStart(2, "0");

export async function SecaoAReceber() {
  const supabase = await createServerSupabase();
  const { ano, mes } = partesNoFuso(new Date(), "America/Sao_Paulo");
  const ini = `${ano}-${pad(mes)}-01`;
  const fim = `${ano}-${pad(mes)}-${pad(ultimoDiaDoMes(ano, mes))}`;

  const [raRes, contasRes, membrosRes, recebidasRes] = await Promise.all([
    supabase.from("receitas_agendadas").select("*").eq("ativo", true).order("data_prevista"),
    supabase.from("accounts").select("id, nome, titular").order("nome"),
    supabase.from("members").select("nome, renda_mensal_centavos"),
    supabase.from("transactions").select("receita_agendada_id, valor_centavos")
      .not("receita_agendada_id", "is", null).gte("data_compra", ini).lte("data_compra", fim),
  ]);
  const erro = raRes.error ?? contasRes.error ?? membrosRes.error ?? recebidasRes.error;
  if (erro) throw new Error(`Falha ao carregar as receitas a receber: ${erro.message}`);

  const receitas = (raRes.data ?? []) as ReceitaAgendada[];
  const contas = contasRes.data ?? [];
  const membros = (membrosRes.data ?? []).map((m) => m.nome);
  const temRenda = (membrosRes.data ?? []).some((m) => (m.renda_mensal_centavos ?? 0) > 0);
  const jaTemSalario = receitas.some((r) => r.origem_salario);
  const nomeConta = new Map(contas.map((c) => [c.id, c.nome]));
  // o que já foi recebido neste mês, por receita agendada
  const recebidoNoMes = new Map<string, number>();
  for (const t of recebidasRes.data ?? []) if (t.receita_agendada_id) recebidoNoMes.set(t.receita_agendada_id, t.valor_centavos);
  // pendente do mês = só o que ainda não recebi
  const totalPendente = receitas.filter((r) => !recebidoNoMes.has(r.id)).reduce((s, r) => s + r.valor_centavos, 0);
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-[var(--muted)]">
        O que você tem a receber (salário, freela, reembolso): quando, pra qual conta e com qual recorrência.
        {totalPendente > 0
          ? <> Ainda a receber neste mês: <Money centavos={totalPendente} tamanho="sm" />.</>
          : <> Tudo deste mês já recebido.</>} Ao marcar “Recebi”, vira uma receita na conta.
      </p>

      {(temRenda || jaTemSalario) && <SalarioSync jaTem={jaTemSalario} />}

      <AddReceitaAgendada contas={contas} membros={membros} />

      {receitas.length === 0 ? (
        <Card><p className="text-sm text-[var(--muted)]">Nada agendado ainda. Agende o que você tem a receber (ex.: salário, um freela).</p></Card>
      ) : (
        <Card>
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {receitas.map((r) => {
              const data = new Date(r.data_prevista + "T12:00:00").toLocaleDateString("pt-BR");
              const atrasada = r.data_prevista < hoje;
              const recebido = recebidoNoMes.get(r.id);
              const jaRecebido = recebido != null;
              return (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="break-words font-medium text-[var(--text)]">
                      {r.descricao}
                      {r.origem_salario && (
                        <span className="ml-2 rounded-full px-2 py-0.5 align-middle text-[0.65rem] font-medium"
                          style={{ background: "var(--positivo-weak, color-mix(in srgb, var(--positivo) 15%, transparent))", color: "var(--positivo)" }}>salário</span>
                      )}
                    </span>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                      {jaRecebido
                        ? <span className="text-[var(--positivo)]">recebido este mês: <Money centavos={recebido!} tamanho="sm" /></span>
                        : <span style={atrasada ? { color: "var(--alerta)" } : undefined}>{atrasada ? "venceu " : "prev. "}{data}</span>}
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
                    <ReceitaAcoes id={r.id} valorBase={r.valor_centavos} jaRecebido={jaRecebido} />
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
