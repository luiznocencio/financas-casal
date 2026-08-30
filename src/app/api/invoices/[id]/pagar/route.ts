import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";

// Marca (ou desmarca) uma fatura inteira como paga.
// Ao pagar: o total sai de uma CONTA escolhida (transferência que reduz o saldo,
// sem contar como despesa nova) e as compras da fatura viram paga (libera limite).
// Ao desfazer: apaga esse lançamento de pagamento e reabre a fatura.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const paga = body.paga !== false; // default: marcar como paga
  const supabase = await createServerSupabase();

  if (paga) {
    const accountId: string | null = body.account_id ?? null;
    if (!accountId) return NextResponse.json({ error: "escolha a conta de onde sai o pagamento" }, { status: 400 });

    // idempotência: se já existe um pagamento pra essa fatura, não abate de novo
    const { data: jaPago, error: errJa } = await supabase
      .from("transactions").select("id").eq("pagamento_invoice_id", id).limit(1);
    if (errJa) return NextResponse.json({ error: errJa.message }, { status: 500 });
    if ((jaPago ?? []).length > 0) return NextResponse.json({ error: "fatura já paga" }, { status: 409 });

    // total da fatura = soma das compras dela
    const { data: comprasFatura, error: errSum } = await supabase
      .from("transactions").select("valor_centavos").eq("invoice_id", id);
    if (errSum) return NextResponse.json({ error: errSum.message }, { status: 500 });
    const total = (comprasFatura ?? []).reduce((s, t) => s + t.valor_centavos, 0);

    // lançamento de pagamento na conta (transferência: reduz saldo, não é despesa nova)
    const { error: errPag } = await supabase.from("transactions").insert({
      household_id: membro.household_id, tipo: "transferencia", valor_centavos: total,
      data_compra: new Date().toISOString().slice(0, 10), categoria_id: null, pessoa: "conjunto",
      account_id: accountId, card_id: null, invoice_id: null, total_parcelas: 1, parcela_n: 1,
      descricao: "Pagamento de fatura", criado_por: membro.user_id, paga: false, origem_ia: false,
      pagamento_invoice_id: id,
    });
    if (errPag) return NextResponse.json({ error: errPag.message }, { status: 500 });

    await supabase.from("transactions").update({ paga: true }).eq("invoice_id", id);
    await supabase.from("invoices").update({ status: "paga" }).eq("id", id);
    return NextResponse.json({ ok: true, paga: true });
  }

  // desfazer: apaga o pagamento e reabre a fatura
  await supabase.from("transactions").delete().eq("pagamento_invoice_id", id);
  await supabase.from("transactions").update({ paga: false }).eq("invoice_id", id);
  await supabase.from("invoices").update({ status: "aberta" }).eq("id", id);
  return NextResponse.json({ ok: true, paga: false });
}
