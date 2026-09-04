import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";
import { partesNoFuso } from "@/lib/financeiro/fechamento";

const pad = (n: number) => String(n).padStart(2, "0");

// Puxa/atualiza a renda do orçamento como receitas mensais em "A receber":
// DUAS partes por pessoa (Salário e Ajuda de custo), cada uma na conta escolhida
// no orçamento (ou na conta do titular). Idempotente: casa por pessoa + descrição
// (origem_salario) e só atualiza valor/conta pra bater com o orçamento.
export async function POST() {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const supabase = await createServerSupabase();

  const [membrosRes, contasRes, salariosRes] = await Promise.all([
    supabase.from("members").select("nome, renda_mensal_centavos, ajuda_custo_centavos, salario_account_id, ajuda_custo_account_id"),
    supabase.from("accounts").select("id, nome, titular"),
    supabase.from("receitas_agendadas").select("id, pessoa, descricao").eq("origem_salario", true).eq("ativo", true),
  ]);
  const erro = membrosRes.error ?? contasRes.error ?? salariosRes.error;
  if (erro) return NextResponse.json({ error: erro.message }, { status: 500 });

  const contas = contasRes.data ?? [];
  if (contas.length === 0) return NextResponse.json({ error: "cadastre ao menos uma conta antes" }, { status: 400 });
  const contaValida = (id: string | null) => (id && contas.some((c) => c.id === id) ? id : null);
  // casa por "pessoa|descrição"
  const existentePor = new Map((salariosRes.data ?? []).map((s) => [`${s.pessoa}|${s.descricao}`, s.id]));

  const { ano, mes } = partesNoFuso(new Date(), "America/Sao_Paulo");
  const dataPrevista = `${ano}-${pad(mes)}-05`;

  let criados = 0;
  let atualizados = 0;
  const semConta = new Set<string>();

  for (const m of membrosRes.data ?? []) {
    const contaTitular = contas.find((c) => c.titular === m.nome) ?? (contas.length === 1 ? contas[0] : null);
    const partes = [
      { desc: "Salário", valor: m.renda_mensal_centavos ?? 0, conta: contaValida(m.salario_account_id) ?? contaTitular?.id ?? null },
      { desc: "Ajuda de custo", valor: m.ajuda_custo_centavos ?? 0, conta: contaValida(m.ajuda_custo_account_id) ?? contaTitular?.id ?? null },
    ];

    for (const p of partes) {
      if (!(p.valor > 0)) continue;
      if (!p.conta) { semConta.add(m.nome); continue; }
      const id = existentePor.get(`${m.nome}|${p.desc}`);
      if (id) {
        const { error } = await supabase.from("receitas_agendadas")
          .update({ valor_centavos: p.valor, account_id: p.conta }).eq("id", id);
        if (!error) atualizados++;
      } else {
        const { error } = await supabase.from("receitas_agendadas").insert({
          household_id: membro.household_id, descricao: p.desc, valor_centavos: p.valor,
          account_id: p.conta, pessoa: m.nome, data_prevista: dataPrevista,
          recorrencia: "mensal", origem_salario: true,
        });
        if (!error) criados++;
      }
    }
  }

  return NextResponse.json({ criados, atualizados, semConta: [...semConta] });
}
