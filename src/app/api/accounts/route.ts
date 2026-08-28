import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";
import { saldoConta } from "@/lib/financeiro/derivados";

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: contas } = await supabase.from("accounts").select("*").order("nome");
  const { data: txs } = await supabase
    .from("transactions").select("account_id, tipo, valor_centavos").not("account_id", "is", null);

  const resultado = (contas ?? []).map((c) => {
    const movimentos = (txs ?? []).filter((t) => t.account_id === c.id);
    return { ...c, saldo_atual_centavos: saldoConta(c.saldo_inicial_centavos, movimentos) };
  });
  return NextResponse.json(resultado);
}

export async function POST(req: Request) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const body = await req.json();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("accounts")
    .insert({
      household_id: membro.household_id,
      nome: body.nome,
      tipo: body.tipo ?? "corrente",
      saldo_inicial_centavos: body.saldo_inicial_centavos ?? 0,
      titular: body.titular ?? null,
    })
    .select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
