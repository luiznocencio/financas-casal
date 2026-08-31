import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";
import { partesNoFuso } from "@/lib/financeiro/fechamento";

const pad = (n: number) => String(n).padStart(2, "0");

// Puxa/atualiza o salário fixo do orçamento como receita mensal em "A receber".
// Um por membro com renda > 0, na conta do titular. Idempotente: se já existe
// (origem_salario), só atualiza o valor pra bater com a renda atual do orçamento.
export async function POST() {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const supabase = await createServerSupabase();

  const [membrosRes, contasRes, salariosRes] = await Promise.all([
    supabase.from("members").select("nome, renda_mensal_centavos"),
    supabase.from("accounts").select("id, nome, titular"),
    supabase.from("receitas_agendadas").select("id, pessoa, account_id").eq("origem_salario", true).eq("ativo", true),
  ]);
  const erro = membrosRes.error ?? contasRes.error ?? salariosRes.error;
  if (erro) return NextResponse.json({ error: erro.message }, { status: 500 });

  const contas = contasRes.data ?? [];
  if (contas.length === 0) return NextResponse.json({ error: "cadastre ao menos uma conta antes" }, { status: 400 });
  const salarioPorPessoa = new Map((salariosRes.data ?? []).map((s) => [s.pessoa, s]));

  const { ano, mes } = partesNoFuso(new Date(), "America/Sao_Paulo");
  const dataPrevista = `${ano}-${pad(mes)}-05`;

  let criados = 0;
  let atualizados = 0;
  const semConta: string[] = [];

  for (const m of membrosRes.data ?? []) {
    const renda = m.renda_mensal_centavos ?? 0;
    if (!(renda > 0)) continue;
    // conta do titular; se não houver e a casa tiver só uma conta, usa ela.
    // Com várias contas e nenhuma do titular, não adivinha (não joga na conta de outro).
    const contaDoTitular = contas.find((c) => c.titular === m.nome) ?? (contas.length === 1 ? contas[0] : null);
    if (!contaDoTitular) { semConta.push(m.nome); continue; }

    const existente = salarioPorPessoa.get(m.nome);
    if (existente) {
      const { error } = await supabase.from("receitas_agendadas")
        .update({ valor_centavos: renda }).eq("id", existente.id);
      if (!error) atualizados++;
    } else {
      const { error } = await supabase.from("receitas_agendadas").insert({
        household_id: membro.household_id,
        descricao: "Salário",
        valor_centavos: renda,
        account_id: contaDoTitular.id,
        pessoa: m.nome,
        data_prevista: dataPrevista,
        recorrencia: "mensal",
        origem_salario: true,
      });
      if (!error) criados++;
    }
  }

  return NextResponse.json({ criados, atualizados, semConta });
}
