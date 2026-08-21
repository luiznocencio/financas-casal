import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { interpretarLancamento } from "@/lib/ai/lancamento";
import { chamarModeloJson } from "@/lib/ai/openai";

export async function POST(req: Request) {
  const { texto } = await req.json();
  const supabase = await createServerSupabase();
  const [{ data: cartoes }, { data: contas }, { data: categorias }, { data: membros }] =
    await Promise.all([
      supabase.from("cards").select("id, nome"),
      supabase.from("accounts").select("id, nome"),
      supabase.from("categories").select("id, nome"),
      supabase.from("members").select("nome"),
    ]);

  const ctx = {
    cartoes: cartoes ?? [], contas: contas ?? [], categorias: categorias ?? [],
    membros: (membros ?? []).map((m) => m.nome),
  };

  try {
    const sugestao = await interpretarLancamento(texto, ctx, chamarModeloJson);
    return NextResponse.json({ ok: true, sugestao });
  } catch {
    // fallback: UI abre o formulário rápido
    return NextResponse.json({ ok: false });
  }
}
