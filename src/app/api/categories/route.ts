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
  const { data, error } = await supabase
    .from("categories")
    .insert({
      household_id: membro.household_id,
      nome: body.nome,
      tipo: body.tipo ?? "despesa",
      cor: body.cor ?? "#6b7280",
      icone: body.icone ?? null,
    })
    .select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
