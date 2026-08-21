import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";
import { planejarLinhas } from "@/lib/financeiro/planejar";
import type { NovoLancamento } from "@/lib/financeiro/tipos";

export async function POST(req: Request) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const l = (await req.json()) as NovoLancamento;
  const supabase = await createServerSupabase();

  // limita parcelas no servidor (evita amplificação: N linhas + N upserts por request)
  l.total_parcelas = Math.min(72, Math.max(1, Math.floor(Number(l.total_parcelas) || 1)));
  if (!(l.valor_centavos > 0)) return NextResponse.json({ error: "valor inválido" }, { status: 400 });

  // dia de fechamento do cartão (se for cartão)
  let diaFechamento: number | null = null;
  if (l.card_id) {
    const { data: card } = await supabase.from("cards").select("dia_fechamento").eq("id", l.card_id).single();
    if (!card) return NextResponse.json({ error: "cartão inexistente" }, { status: 400 });
    diaFechamento = card.dia_fechamento;
  }

  if (l.account_id) {
    const { data: conta } = await supabase.from("accounts").select("id").eq("id", l.account_id).maybeSingle();
    if (!conta) return NextResponse.json({ error: "conta inexistente" }, { status: 400 });
  }

  const linhas = planejarLinhas(l, diaFechamento);

  // garante as faturas (invoices) das competências e mapeia competência -> invoice_id
  const invoiceIdPorComp = new Map<string, string>();
  for (const linha of linhas) {
    if (!linha.invoiceCompetencia || !l.card_id) continue;
    const chave = `${linha.invoiceCompetencia.ano}-${linha.invoiceCompetencia.mes}`;
    if (invoiceIdPorComp.has(chave)) continue;
    const { data: inv, error: invoiceError } = await supabase
      .from("invoices")
      .upsert(
        {
          household_id: membro.household_id, card_id: l.card_id,
          competencia_ano: linha.invoiceCompetencia.ano,
          competencia_mes: linha.invoiceCompetencia.mes,
        },
        { onConflict: "card_id,competencia_ano,competencia_mes" },
      )
      .select("id").single();
    if (invoiceError || !inv) {
      return NextResponse.json({ error: "falha ao gerar fatura" }, { status: 500 });
    }
    invoiceIdPorComp.set(chave, inv.id);
  }

  const registros = linhas.map((linha) => {
    const chave = linha.invoiceCompetencia
      ? `${linha.invoiceCompetencia.ano}-${linha.invoiceCompetencia.mes}` : null;
    return {
      household_id: membro.household_id,
      tipo: linha.tipo, valor_centavos: linha.valor_centavos,
      data_compra: linha.data_compra, categoria_id: linha.categoria_id,
      pessoa: linha.pessoa, account_id: linha.account_id, card_id: linha.card_id,
      invoice_id: chave ? invoiceIdPorComp.get(chave) ?? null : null,
      grupo_parcela: linha.grupo_parcela, parcela_n: linha.parcela_n,
      total_parcelas: linha.total_parcelas, descricao: linha.descricao,
      criado_por: membro.user_id, origem_ia: l.origem_ia ?? false,
    };
  });

  const { data, error } = await supabase.from("transactions").insert(registros).select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ criadas: data });
}
