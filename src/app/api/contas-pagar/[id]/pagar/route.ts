import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";
import { persistirLancamento } from "@/lib/financeiro/persistir";
import { partesNoFuso, ultimoDiaDoMes } from "@/lib/financeiro/fechamento";
import type { ContaPagar } from "@/lib/db/tipos";

const pad = (n: number) => String(n).padStart(2, "0");

// Marca "pago": cria a despesa de verdade com o VALOR informado (varia mês a mês),
// na origem da conta, ligada por conta_pagar_id. Se for única, encerra.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const valor = Math.round(Number(b.valor_centavos) || 0);
  if (!(valor > 0)) return NextResponse.json({ error: "informe o valor pago" }, { status: 400 });
  const accountId: string | null = b.account_id ?? null;
  if (!accountId) return NextResponse.json({ error: "escolha a conta de onde saiu o pagamento" }, { status: 400 });

  const supabase = await createServerSupabase();
  const { data: cp, error } = await supabase.from("contas_pagar").select("*").eq("id", id).maybeSingle();
  if (error || !cp) return NextResponse.json({ error: "conta não encontrada" }, { status: 400 });
  const c = cp as ContaPagar;

  // já paga neste mês? (evita duplicar por API/duplo-clique)
  const { ano, mes } = partesNoFuso(new Date(), "America/Sao_Paulo");
  const { count } = await supabase.from("transactions").select("id", { count: "exact", head: true })
    .eq("conta_pagar_id", id).gte("data_compra", `${ano}-${pad(mes)}-01`).lte("data_compra", `${ano}-${pad(mes)}-${pad(ultimoDiaDoMes(ano, mes))}`);
  if ((count ?? 0) > 0) return NextResponse.json({ error: "já paga este mês" }, { status: 400 });

  const hoje = new Date().toISOString().slice(0, 10);
  const { error: errTx } = await persistirLancamento(
    supabase,
    { householdId: membro.household_id, criadoPor: membro.user_id, contaPagarId: c.id },
    {
      tipo: "despesa", valor_centavos: valor, data_compra: hoje,
      categoria_id: c.categoria_id, pessoa: c.pessoa,
      account_id: accountId, card_id: null,
      total_parcelas: 1, descricao: c.descricao, origem_ia: false,
    },
  );
  if (errTx) return NextResponse.json({ error: errTx }, { status: 500 });

  if (c.recorrencia === "unica") {
    await supabase.from("contas_pagar").update({ ativo: false }).eq("id", id);
  }
  return NextResponse.json({ ok: true });
}
