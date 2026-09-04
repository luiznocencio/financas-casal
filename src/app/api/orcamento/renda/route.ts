import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";

export async function POST(req: Request) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const salario = Math.max(0, Math.round(Number(body.renda_mensal_centavos) || 0));
  const ajuda = Math.max(0, Math.round(Number(body.ajuda_custo_centavos) || 0));
  // qual membro: o informado (parceiro) ou, por padrão, o próprio usuário
  const userId = typeof body.user_id === "string" ? body.user_id : membro.user_id;
  const supabase = await createServerSupabase();
  // a RLS (members_update, escopada ao household) garante que só dá pra editar
  // um membro do próprio lar
  const { error } = await supabase
    .from("members").update({
      renda_mensal_centavos: salario,
      ajuda_custo_centavos: ajuda,
      salario_account_id: body.salario_account_id ?? null,
      ajuda_custo_account_id: body.ajuda_custo_account_id ?? null,
    }).eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
