import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";
import { persistirLancamento } from "@/lib/financeiro/persistir";
import { partesNoFuso, ultimoDiaDoMes } from "@/lib/financeiro/fechamento";
import { normalizeDescricao } from "@/lib/financeiro/descricao";
import type { Recorrente } from "@/lib/db/tipos";

const pad = (n: number) => String(n).padStart(2, "0");

// Lança os fixos ativos do mês atual que ainda não foram lançados (idempotente
// por recorrente_id + mês, então clicar 2x não duplica).
export async function POST() {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });

  const supabase = await createServerSupabase();
  const { ano, mes } = partesNoFuso(new Date(), "America/Sao_Paulo");
  const ultimo = ultimoDiaDoMes(ano, mes);
  const ini = `${ano}-${pad(mes)}-01`;
  const fim = `${ano}-${pad(mes)}-${pad(ultimo)}`;

  // faturas desta competência (pra deduplicar contra o gasto do cartão, que tem a
  // data real da compra — ex.: agosto — mas cai na fatura deste mês)
  const { data: invs } = await supabase.from("invoices").select("id").eq("competencia_ano", ano).eq("competencia_mes", mes);
  const invIds = (invs ?? []).map((i) => i.id);

  const cols = "recorrente_id, descricao, valor_centavos, card_id, account_id";
  const [recsRes, contasEx, cartaoEx] = await Promise.all([
    supabase.from("recorrentes").select("*").eq("ativo", true),
    // conta/pix: lançamentos do mês pela data
    supabase.from("transactions").select(cols).not("account_id", "is", null).gte("data_compra", ini).lte("data_compra", fim),
    // cartão: lançamentos que caem na fatura desta competência
    invIds.length ? supabase.from("transactions").select(cols).in("invoice_id", invIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (recsRes.error || contasEx.error || cartaoEx.error) {
    return NextResponse.json({ error: recsRes.error?.message ?? contasEx.error?.message ?? cartaoEx.error?.message }, { status: 500 });
  }

  const existentes = [...(contasEx.data ?? []), ...(cartaoEx.data ?? [])];
  const feitos = new Set(existentes.filter((t) => t.recorrente_id != null).map((t) => t.recorrente_id));
  // casa descrições sendo tolerante (ex.: "Netflix" x "NETFLIX.COM")
  const casaDescricao = (a: string, b: string) => {
    const x = normalizeDescricao(a), y = normalizeDescricao(b);
    return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
  };
  // já existe um lançamento equivalente (mesma origem + valor + descrição parecida)?
  function temEquivalente(r: Recorrente): boolean {
    return existentes.some((t) =>
      t.valor_centavos === r.valor_centavos &&
      (r.card_id ? t.card_id === r.card_id : t.account_id === r.account_id) &&
      casaDescricao(t.descricao ?? "", r.descricao),
    );
  }

  const recs = (recsRes.data ?? []) as Recorrente[];
  let criadas = 0;
  let pulados = 0;
  const falhas: string[] = [];
  for (const r of recs) {
    if (feitos.has(r.id) || temEquivalente(r)) { pulados++; continue; }
    const dia = Math.min(r.dia, ultimo);
    const data = `${ano}-${pad(mes)}-${pad(dia)}`;
    if (r.data_fim && data > r.data_fim) { pulados++; continue; } // fixo já encerrado
    const { error } = await persistirLancamento(
      supabase,
      { householdId: membro.household_id, criadoPor: membro.user_id, recorrenteId: r.id },
      {
        tipo: "despesa", valor_centavos: r.valor_centavos, data_compra: data,
        categoria_id: r.categoria_id, pessoa: r.pessoa,
        account_id: r.account_id, card_id: r.card_id,
        total_parcelas: 1, descricao: r.descricao, origem_ia: false,
      },
    );
    if (error) falhas.push(r.descricao);
    else { criadas++; feitos.add(r.id); }
  }
  return NextResponse.json({ criadas, pulados, falhas, mes, ano });
}
