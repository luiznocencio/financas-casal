import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";

export async function GET() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("categories").select("*").order("nome");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const body = await req.json();
  const supabase = await createServerSupabase();

  // subcategoria: herda o tipo da mãe e só pode pendurar numa categoria de 1º nível
  let parentId: string | null = null;
  let tipo = body.tipo ?? "despesa";
  if (body.parent_id) {
    const { data: pai } = await supabase.from("categories")
      .select("id, tipo, parent_id").eq("id", body.parent_id).maybeSingle();
    if (!pai) return NextResponse.json({ error: "categoria mãe não encontrada" }, { status: 400 });
    if (pai.parent_id) return NextResponse.json({ error: "uma subcategoria não pode ter subcategorias" }, { status: 400 });
    parentId = pai.id;
    tipo = pai.tipo;
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({
      household_id: membro.household_id,
      nome: body.nome,
      tipo,
      cor: body.cor ?? "#6b7280",
      icone: body.icone ?? null,
      parent_id: parentId,
    })
    .select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
