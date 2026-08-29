import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";

// Move um lote de importação inteiro para outra origem (ex.: aloquei no cartão
// errado). Cartão → remapeia as faturas por competência; conta → tira da fatura.
export async function PATCH(req: Request, { params }: { params: Promise<{ grupo: string }> }) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const { grupo } = await params;
  const b = await req.json().catch(() => ({}));
  const destCard: string | null = b.card_id ?? null;
  const destAcc: string | null = b.account_id ?? null;
  if (!destCard && !destAcc) return NextResponse.json({ error: "destino inválido" }, { status: 400 });

  const supabase = await createServerSupabase();
  const { data: txs, error: txErr } = await supabase
    .from("transactions").select("id, invoice_id").eq("grupo_importacao", grupo);
  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });
  if (!txs?.length) return NextResponse.json({ movidas: 0 });

  // destino = conta: sai da fatura
  if (destAcc) {
    const { error } = await supabase.from("transactions")
      .update({ account_id: destAcc, card_id: null, invoice_id: null })
      .eq("grupo_importacao", grupo);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ movidas: txs.length });
  }

  // destino = cartão: mantém a competência de cada lançamento, remapeando pra fatura do novo cartão
  const invoiceIds = [...new Set(txs.map((t) => t.invoice_id).filter(Boolean))] as string[];
  const invsRes = invoiceIds.length
    ? await supabase.from("invoices").select("id, competencia_ano, competencia_mes").in("id", invoiceIds)
    : { data: [], error: null };
  if (invsRes.error) return NextResponse.json({ error: invsRes.error.message }, { status: 500 });
  const compPorInvoice = new Map((invsRes.data ?? []).map((i) => [i.id, { ano: i.competencia_ano, mes: i.competencia_mes }]));

  const novoInvoicePorComp = new Map<string, string>();
  async function invoiceDestino(ano: number, mes: number): Promise<string | null> {
    const chave = `${ano}-${mes}`;
    const existente = novoInvoicePorComp.get(chave);
    if (existente) return existente;
    const { data: inv, error } = await supabase.from("invoices").upsert(
      { household_id: membro!.household_id, card_id: destCard, competencia_ano: ano, competencia_mes: mes },
      { onConflict: "card_id,competencia_ano,competencia_mes" },
    ).select("id").single();
    if (error || !inv) return null;
    novoInvoicePorComp.set(chave, inv.id);
    return inv.id;
  }

  // um update por fatura de origem (poucas competências)
  for (const oldInvId of invoiceIds) {
    const comp = compPorInvoice.get(oldInvId);
    const novoInv = comp ? await invoiceDestino(comp.ano, comp.mes) : null;
    const { error } = await supabase.from("transactions")
      .update({ card_id: destCard, account_id: null, invoice_id: novoInv })
      .eq("grupo_importacao", grupo).eq("invoice_id", oldInvId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // lançamentos do lote sem fatura (ex.: vieram de conta): só troca a origem
  const { error: semInvErr } = await supabase.from("transactions")
    .update({ card_id: destCard, account_id: null })
    .eq("grupo_importacao", grupo).is("invoice_id", null);
  if (semInvErr) return NextResponse.json({ error: semInvErr.message }, { status: 500 });

  // apaga as faturas de origem que ficaram sem nenhum lançamento
  for (const oldInvId of invoiceIds) {
    const { count } = await supabase.from("transactions")
      .select("id", { count: "exact", head: true }).eq("invoice_id", oldInvId);
    if ((count ?? 0) === 0) await supabase.from("invoices").delete().eq("id", oldInvId);
  }

  return NextResponse.json({ movidas: txs.length });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ grupo: string }> }) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const { grupo } = await params;
  const supabase = await createServerSupabase();
  const { error, count } = await supabase
    .from("transactions").delete({ count: "exact" }).eq("grupo_importacao", grupo);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, apagadas: count ?? 0 });
}
