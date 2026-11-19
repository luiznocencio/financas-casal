import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";
import { hojeISO } from "@/lib/financeiro/fechamento";

// Resgate de uma meta: tira parte do guardado e manda para uma conta.
// - goal_contributions recebe um valor NEGATIVO (o guardado diminui);
// - a conta recebe uma transferência de entrada (aumenta o saldo sem contar
//   como receita do mês), ligada à meta por goal_id.
export async function POST(req: Request) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  const goal_id: string = b.goal_id;
  const valor = Math.round(Number(b.valor_centavos) || 0);
  const accountId: string | null = b.account_id || null;
  if (!goal_id || !(valor > 0)) return NextResponse.json({ error: "Informe um valor maior que zero." }, { status: 400 });

  const hoje = hojeISO();
  const data: string = b.data || hoje;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data > hoje) {
    return NextResponse.json({ error: "Data inválida." }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const [metaRes, aportesRes, contaRes] = await Promise.all([
    supabase.from("goals").select("id, nome").eq("id", goal_id).maybeSingle(),
    supabase.from("goal_contributions").select("valor_centavos").eq("goal_id", goal_id),
    accountId ? supabase.from("accounts").select("id").eq("id", accountId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  const meta = metaRes.data;
  if (!meta) return NextResponse.json({ error: "Meta inexistente." }, { status: 400 });
  if (aportesRes.error) return NextResponse.json({ error: aportesRes.error.message }, { status: 500 });
  if (accountId && !contaRes.data) return NextResponse.json({ error: "Conta inexistente." }, { status: 400 });

  const guardado = (aportesRes.data ?? []).reduce((s, a) => s + a.valor_centavos, 0);
  if (valor > guardado) {
    return NextResponse.json({ error: "Valor maior do que o guardado nesta meta." }, { status: 400 });
  }

  if (accountId) {
    const { error: errTx } = await supabase.from("transactions").insert({
      household_id: membro.household_id, tipo: "transferencia_entrada", valor_centavos: valor,
      data_compra: data, categoria_id: null, pessoa: "conjunto", account_id: accountId, card_id: null,
      total_parcelas: 1, parcela_n: 1, descricao: `Resgate: ${meta.nome}`,
      criado_por: membro.user_id, paga: false, origem_ia: false, goal_id,
    });
    if (errTx) return NextResponse.json({ error: errTx.message }, { status: 500 });
  }

  const { error } = await supabase.from("goal_contributions").insert({
    household_id: membro.household_id, goal_id, valor_centavos: -valor,
    data, descricao: b.descricao ?? "Resgate",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
