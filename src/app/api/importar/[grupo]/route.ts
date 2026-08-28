import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";

export async function DELETE(_req: Request, { params }: { params: Promise<{ grupo: string }> }) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const { grupo } = await params;
  const supabase = await createServerSupabase();
  const { error, count } = await supabase
    .from("transactions").delete({ count: "exact" }).eq("grupo_importacao", grupo);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, apagadas: count ?? 0 });
}
