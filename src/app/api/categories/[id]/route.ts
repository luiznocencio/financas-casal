import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof b.nome === "string" && b.nome.trim()) patch.nome = b.nome.trim();
  if (typeof b.cor === "string") patch.cor = b.cor;
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true }); // nada a atualizar
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("categories").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const { id } = await params;
  const supabase = await createServerSupabase();
  // FKs: transactions.categoria_id -> set null (viram "Outros");
  // budgets e category_rules -> cascade (o % e as regras somem junto).
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
