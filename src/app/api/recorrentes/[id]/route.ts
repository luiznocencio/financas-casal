import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const { id } = await params;
  const supabase = await createServerSupabase();
  // os lançamentos já gerados ficam (recorrente_id vira null pelo FK); só a regra some
  const { error } = await supabase.from("recorrentes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
