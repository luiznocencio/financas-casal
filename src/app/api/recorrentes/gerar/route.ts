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

  const [recsRes, existRes] = await Promise.all([
    supabase.from("recorrentes").select("*").eq("ativo", true),
    // tudo que já foi lançado neste mês (pra não duplicar: nem o próprio fixo, nem um lançamento manual equivalente)
    supabase.from("transactions").select("recorrente_id, descricao, valor_centavos, card_id, account_id")
      .gte("data_compra", ini).lte("data_compra", fim),
  ]);
  if (recsRes.error || existRes.error) {
    return NextResponse.json({ error: recsRes.error?.message ?? existRes.error?.message }, { status: 500 });
  }

  const existentes = existRes.data ?? [];
  const feitos = new Set(existentes.filter((t) => t.recorrente_id != null).map((t) => t.recorrente_id));
  // já existe um lançamento manual equivalente? (mesma origem + valor + descrição)
  function temManualEquivalente(r: Recorrente): boolean {
    return existentes.some((t) =>
      t.recorrente_id == null &&
      t.valor_centavos === r.valor_centavos &&
      (r.card_id ? t.card_id === r.card_id : t.account_id === r.account_id) &&
      normalizeDescricao(t.descricao ?? "") === normalizeDescricao(r.descricao),
    );
  }

  const recs = (recsRes.data ?? []) as Recorrente[];
  let criadas = 0;
  let pulados = 0;
  const falhas: string[] = [];
  for (const r of recs) {
    if (feitos.has(r.id) || temManualEquivalente(r)) { pulados++; continue; }
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
