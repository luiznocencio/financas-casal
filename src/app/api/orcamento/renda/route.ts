import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";

export async function POST(req: Request) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const renda = Math.max(0, Math.round(Number(body.renda_mensal_centavos) || 0));
  // qual membro: o informado (parceiro) ou, por padrão, o próprio usuário
  const userId = typeof body.user_id === "string" ? body.user_id : membro.user_id;
  const supabase = await createServerSupabase();
  // a RLS (members_update, escopada ao household) garante que só dá pra editar
  // um membro do próprio lar
  const { error } = await supabase
    .from("members").update({ renda_mensal_centavos: renda }).eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, renda_mensal_centavos: renda });
}
