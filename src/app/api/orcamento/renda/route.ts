import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";

export async function POST(req: Request) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const renda = Math.max(0, Math.round(Number(body.renda_mensal_centavos) || 0));
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("households").update({ renda_mensal_centavos: renda }).eq("id", membro.household_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, renda_mensal_centavos: renda });
}
