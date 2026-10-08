import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";
import { persistirLancamento } from "@/lib/financeiro/persistir";
import { partesNoFuso } from "@/lib/financeiro/fechamento";
import { contaOcorreNoMes, mesesEmAberto, chaveMes, quitadosPorConta } from "@/lib/financeiro/contas";
import type { ContaPagar } from "@/lib/db/tipos";

const pad = (n: number) => String(n).padStart(2, "0");

// Marca "pago": cria a despesa de verdade com o VALOR informado (varia mês a mês),
// na origem da conta, ligada por conta_pagar_id. `ref` diz QUAL mês da conta foi
// quitado (pode ser um atrasado) e `data` é o dia em que foi pago de fato (pode
// ser antes de hoje — nem sempre se lança no mesmo dia). Se for única, encerra.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const valor = Math.round(Number(b.valor_centavos) || 0);
  if (!(valor > 0)) return NextResponse.json({ error: "informe o valor pago" }, { status: 400 });
  const accountId: string | null = b.account_id ?? null;
  if (!accountId) return NextResponse.json({ error: "escolha a conta de onde saiu o pagamento" }, { status: 400 });

  // data do pagamento: padrão hoje; não aceita data futura nem inválida
  const hojeP = partesNoFuso(new Date(), "America/Sao_Paulo");
  const hoje = `${hojeP.ano}-${pad(hojeP.mes)}-${pad(hojeP.dia)}`;
  const data: string = typeof b.data === "string" && b.data ? b.data : hoje;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(`${data}T12:00:00Z`))) {
    return NextResponse.json({ error: "data inválida" }, { status: 400 });
  }
  if (data > hoje) return NextResponse.json({ error: "a data do pagamento não pode ser no futuro" }, { status: 400 });

  const supabase = await createServerSupabase();
  const { data: cp, error } = await supabase.from("contas_pagar").select("*").eq("id", id).maybeSingle();
  if (error || !cp) return NextResponse.json({ error: "conta não encontrada" }, { status: 400 });
  const c = cp as ContaPagar;

  const { data: pagos, error: errPagos } = await supabase.from("transactions")
    .select("conta_pagar_id, conta_pagar_ref, data_compra").eq("conta_pagar_id", id);
  if (errPagos) return NextResponse.json({ error: errPagos.message }, { status: 500 });
  const quitados = quitadosPorConta(pagos ?? []).get(id) ?? new Set<string>();

  // mês quitado: o informado; senão o mais antigo em aberto; senão o atual
  let ref: string | null = typeof b.ref === "string" ? b.ref : null;
  if (ref && !/^\d{4}-(0[1-9]|1[0-2])$/.test(ref)) return NextResponse.json({ error: "mês inválido" }, { status: 400 });
  if (!ref) {
    const abertos = mesesEmAberto(c, quitados, hojeP);
    ref = abertos.length ? chaveMes(abertos[0]) : chaveMes(hojeP);
  }
  const [ra, rm] = ref.split("-").map(Number);
  if (!contaOcorreNoMes(c, ra, rm)) return NextResponse.json({ error: "essa conta não tem cobrança nesse mês" }, { status: 400 });
  // já quitado? (evita duplicar por API/duplo-clique; o índice único também barra)
  if (quitados.has(ref)) return NextResponse.json({ error: "esse mês já está pago" }, { status: 400 });

  const { error: errTx } = await persistirLancamento(
    supabase,
    { householdId: membro.household_id, criadoPor: membro.user_id, contaPagarId: c.id, contaPagarRef: ref },
    {
      tipo: "despesa", valor_centavos: valor, data_compra: data,
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
