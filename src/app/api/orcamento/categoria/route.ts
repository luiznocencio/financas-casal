import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";

export async function POST(req: Request) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const categoria_id: string = body.categoria_id;
  const valor_centavos = Math.max(0, Math.round(Number(body.valor_centavos) || 0));
  if (!categoria_id) return NextResponse.json({ error: "categoria inválida" }, { status: 400 });
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("budgets")
    .upsert(
      { household_id: membro.household_id, categoria_id, valor_centavos, percentual: 0 },
      { onConflict: "household_id,categoria_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
