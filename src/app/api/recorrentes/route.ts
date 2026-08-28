import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";

export async function GET() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("recorrentes").select("*").order("dia");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  const dia = Number(b.dia);
  if (!b.descricao?.trim() || !(Number(b.valor_centavos) > 0) || !(dia >= 1 && dia <= 31)) {
    return NextResponse.json({ error: "dados inválidos" }, { status: 400 });
  }
  if (!b.account_id && !b.card_id) return NextResponse.json({ error: "escolha de onde sai o dinheiro" }, { status: 400 });

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("recorrentes").insert({
    household_id: membro.household_id,
    descricao: String(b.descricao).trim(),
    valor_centavos: Math.round(Number(b.valor_centavos)),
    categoria_id: b.categoria_id ?? null,
    pessoa: b.pessoa ?? "conjunto",
    dia,
    account_id: b.account_id ?? null,
    card_id: b.card_id ?? null,
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
