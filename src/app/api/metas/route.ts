import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";

export async function POST(req: Request) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  const nome: string = (b.nome ?? "").trim();
  const alvo = Math.round(Number(b.valor_alvo_centavos) || 0);
  if (!nome || !(alvo > 0)) return NextResponse.json({ error: "dados inválidos" }, { status: 400 });
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("goals")
    .insert({ household_id: membro.household_id, nome, valor_alvo_centavos: alvo, data_alvo: b.data_alvo || null })
    .select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
