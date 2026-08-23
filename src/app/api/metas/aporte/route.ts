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
  const { data: meta } = await supabase.from("goals").select("id").eq("id", goal_id).maybeSingle();
  if (!meta) return NextResponse.json({ error: "meta inexistente" }, { status: 400 });
  const { error } = await supabase.from("goal_contributions").insert({
    household_id: membro.household_id, goal_id, valor_centavos: valor,
    data: b.data || new Date().toISOString().slice(0, 10), descricao: b.descricao ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
