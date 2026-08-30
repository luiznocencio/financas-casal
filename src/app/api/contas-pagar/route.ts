import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";

export async function GET() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("contas_pagar").select("*").order("dia_vencimento");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  const dia = Number(b.dia_vencimento);
  if (!b.descricao?.trim() || !(dia >= 1 && dia <= 31)) {
    return NextResponse.json({ error: "preencha descrição e dia de vencimento (1 a 31)" }, { status: 400 });
  }
  if (!b.account_id && !b.card_id) return NextResponse.json({ error: "escolha de onde sai o pagamento" }, { status: 400 });
  const recorrencia = b.recorrencia === "unica" ? "unica" : "mensal";
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("contas_pagar").insert({
    household_id: membro.household_id,
    descricao: String(b.descricao).trim(),
    categoria_id: b.categoria_id ?? null,
    pessoa: b.pessoa ?? "conjunto",
    dia_vencimento: dia,
    valor_estimado_centavos: Number(b.valor_estimado_centavos) > 0 ? Math.round(Number(b.valor_estimado_centavos)) : null,
    account_id: b.account_id ?? null,
    card_id: b.card_id ?? null,
    recorrencia,
    data_fim: /^\d{4}-\d{2}-\d{2}$/.test(b.data_fim ?? "") ? b.data_fim : null,
  }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
