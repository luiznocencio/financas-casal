import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";

export async function POST(req: Request) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  const goal_id: string = b.goal_id;
  const valor = Math.round(Number(b.valor_centavos) || 0);
  if (!goal_id || valor === 0) return NextResponse.json({ error: "dados inválidos" }, { status: 400 });
  const supabase = await createServerSupabase();
  // valida que a meta é do household (RLS já limita; confirma existência)
  const { data: meta } = await supabase.from("goals").select("id, nome").eq("id", goal_id).maybeSingle();
  if (!meta) return NextResponse.json({ error: "meta inexistente" }, { status: 400 });
  const data = b.data || new Date().toISOString().slice(0, 10);

  // se escolheu uma conta, o dinheiro guardado SAI dela (transferência: reduz o
  // saldo sem contar como despesa do mês), ligada à meta por goal_id.
  const accountId: string | null = b.account_id ?? null;
  if (accountId) {
    const { data: conta } = await supabase.from("accounts").select("id").eq("id", accountId).maybeSingle();
    if (!conta) return NextResponse.json({ error: "conta inexistente" }, { status: 400 });
    const { error: errTx } = await supabase.from("transactions").insert({
      household_id: membro.household_id, tipo: "transferencia", valor_centavos: valor,
      data_compra: data, categoria_id: null, pessoa: "conjunto", account_id: accountId, card_id: null,
      total_parcelas: 1, parcela_n: 1, descricao: `Guardado: ${meta.nome}`,
      criado_por: membro.user_id, paga: false, origem_ia: false, goal_id,
    });
    if (errTx) return NextResponse.json({ error: errTx.message }, { status: 500 });
  }

  const { error } = await supabase.from("goal_contributions").insert({
    household_id: membro.household_id, goal_id, valor_centavos: valor,
    data, descricao: b.descricao ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
