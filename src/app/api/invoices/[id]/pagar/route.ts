import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";

// Marca (ou desmarca) uma fatura inteira como paga. Reversível.
// Marcar como paga libera o limite do cartão (limiteDisponivel conta só !paga).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const paga = body.paga !== false; // default: marcar como paga
  const supabase = await createServerSupabase();

  // RLS limita ambos os updates ao household do membro logado.
  const { error: errTx } = await supabase
    .from("transactions").update({ paga }).eq("invoice_id", id);
  if (errTx) return NextResponse.json({ error: errTx.message }, { status: 500 });

  const { error: errInv } = await supabase
    .from("invoices").update({ status: paga ? "paga" : "aberta" }).eq("id", id);
  if (errInv) return NextResponse.json({ error: errInv.message }, { status: 500 });

  return NextResponse.json({ ok: true, paga });
}
