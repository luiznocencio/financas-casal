import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("receitas_agendadas").select("*").order("data_prevista");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  const recorrencia = b.recorrencia === "mensal" ? "mensal" : "unica";
  if (!b.descricao?.trim() || !(Number(b.valor_centavos) > 0) || !b.account_id || !DATA_ISO.test(b.data_prevista ?? "")) {
    return NextResponse.json({ error: "dados inválidos" }, { status: 400 });
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("receitas_agendadas").insert({
    household_id: membro.household_id,
    descricao: String(b.descricao).trim(),
    valor_centavos: Math.round(Number(b.valor_centavos)),
    account_id: b.account_id,
    pessoa: b.pessoa ?? "conjunto",
    data_prevista: b.data_prevista,
    recorrencia,
    data_fim: DATA_ISO.test(b.data_fim ?? "") ? b.data_fim : null,
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
