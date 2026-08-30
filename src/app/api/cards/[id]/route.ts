import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";
import { fechamentoDoVencimento } from "@/lib/financeiro/fechamento";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof b.nome === "string") patch.nome = b.nome.trim();
  if (b.limite_centavos != null) patch.limite_centavos = Math.max(0, Math.round(Number(b.limite_centavos) || 0));
  if (b.dia_vencimento != null) patch.dia_vencimento = Number(b.dia_vencimento);
  // fechamento derivado do vencimento ("N dias antes") ou direto
  if (b.dias_fechamento_antes != null && b.dia_vencimento != null) {
    patch.dias_fechamento_antes = Number(b.dias_fechamento_antes);
    patch.dia_fechamento = fechamentoDoVencimento(Number(b.dia_vencimento), Number(b.dias_fechamento_antes));
  } else if (b.dia_fechamento != null) {
    patch.dia_fechamento = Number(b.dia_fechamento);
  }
  if ("titular" in b) patch.titular = b.titular || null;
  if ("bandeira" in b) patch.bandeira = b.bandeira || null;
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("cards").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const { id } = await params;
  const supabase = await createServerSupabase();
  // FK on delete cascade remove os lançamentos e faturas deste cartão
  const { error } = await supabase.from("cards").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
