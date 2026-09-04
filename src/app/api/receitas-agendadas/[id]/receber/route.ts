import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";
import { persistirLancamento } from "@/lib/financeiro/persistir";
import { ultimoDiaDoMes } from "@/lib/financeiro/fechamento";
import type { ReceitaAgendada } from "@/lib/db/tipos";

const pad = (n: number) => String(n).padStart(2, "0");

// avança a data um mês, com clamp de mês curto
function proximoMes(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return `${ny}-${pad(nm)}-${pad(Math.min(d, ultimoDiaDoMes(ny, nm)))}`;
}

// Marca "recebi": cria a receita de verdade na conta destino. Se for mensal,
// avança a data pro mês seguinte; se for única, desativa (some do "a receber").
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const supabase = await createServerSupabase();

  const { data: ra, error } = await supabase.from("receitas_agendadas").select("*").eq("id", id).maybeSingle();
  if (error || !ra) return NextResponse.json({ error: "não encontrada" }, { status: 400 });
  const r = ra as ReceitaAgendada;
  if (!r.ativo) return NextResponse.json({ error: "já recebida" }, { status: 400 }); // evita receber 2x uma única

  // valor real recebido (salário oscila); sem valor válido, usa o valor base
  const valor = Number(body?.valor_centavos) > 0 ? Math.round(Number(body.valor_centavos)) : r.valor_centavos;
  const hoje = new Date().toISOString().slice(0, 10);
  const { error: errTx } = await persistirLancamento(
    supabase,
    { householdId: membro.household_id, criadoPor: membro.user_id },
    {
      tipo: "receita", valor_centavos: valor, data_compra: hoje,
      categoria_id: null, pessoa: r.pessoa, account_id: r.account_id, card_id: null,
      total_parcelas: 1, descricao: r.descricao, origem_ia: false,
    },
  );
  if (errTx) return NextResponse.json({ error: errTx }, { status: 500 });

  if (r.recorrencia === "mensal") {
    const prox = proximoMes(r.data_prevista);
    // se passou do "até quando", encerra em vez de avançar
    if (r.data_fim && prox > r.data_fim) {
      await supabase.from("receitas_agendadas").update({ ativo: false }).eq("id", id);
    } else {
      await supabase.from("receitas_agendadas").update({ data_prevista: prox }).eq("id", id);
    }
  } else {
    await supabase.from("receitas_agendadas").update({ ativo: false }).eq("id", id);
  }
  return NextResponse.json({ ok: true });
}
