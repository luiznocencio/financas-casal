import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";
import { persistirLancamento } from "@/lib/financeiro/persistir";
import { partesNoFuso, ultimoDiaDoMes } from "@/lib/financeiro/fechamento";
import { recorrenteJaLancado } from "@/lib/financeiro/recorrentes";
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

  // o fixo DESTE mês já existe? Vale a data da cobrança (régua do consumo), em
  // conta e em cartão. Pela fatura não dá: a cobrança de outubro num cartão que
  // fecha no fim do mês cai na fatura de NOVEMBRO — procurar só na de outubro
  // fazia o fixo ser criado de novo a cada clique.
  const cols = "recorrente_id, descricao, valor_centavos, card_id, account_id";
  const [recsRes, doMesRes] = await Promise.all([
    supabase.from("recorrentes").select("*").eq("ativo", true),
    supabase.from("transactions").select(cols).gte("data_compra", ini).lte("data_compra", fim),
  ]);
  if (recsRes.error || doMesRes.error) {
    return NextResponse.json({ error: recsRes.error?.message ?? doMesRes.error?.message }, { status: 500 });
  }

  const existentes = [...(doMesRes.data ?? [])];

  const recs = (recsRes.data ?? []) as Recorrente[];
  let criadas = 0;
  let pulados = 0;
  const falhas: string[] = [];
  for (const r of recs) {
    if (recorrenteJaLancado(r, existentes)) { pulados++; continue; }
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
    // registra o recém-criado pra não duplicar um equivalente no mesmo clique
    else { criadas++; existentes.push({ recorrente_id: r.id, descricao: r.descricao, valor_centavos: r.valor_centavos, card_id: r.card_id, account_id: r.account_id }); }
  }
  return NextResponse.json({ criadas, pulados, falhas, mes, ano });
}
