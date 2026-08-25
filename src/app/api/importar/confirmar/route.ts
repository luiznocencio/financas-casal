import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";
import { persistirLancamento } from "@/lib/financeiro/persistir";
import type { NovoLancamento } from "@/lib/financeiro/tipos";

type ItemImport = {
  data: string; descricao: string; valor_centavos: number;
  tipo: "despesa" | "receita"; total_parcelas: number;
  categoria_id: string | null; pessoa: string;
};

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const origem: { card_id?: string; account_id?: string } = body.origem ?? {};
  const itens: ItemImport[] = Array.isArray(body.linhas) ? body.linhas : [];
  if (!origem.card_id && !origem.account_id) return NextResponse.json({ error: "origem inválida" }, { status: 400 });

  const supabase = await createServerSupabase();

  // lançamentos já existentes nessa origem, p/ pular duplicados (data + valor)
  const origemCol = origem.card_id ? "card_id" : "account_id";
  const origemId = (origem.card_id ?? origem.account_id) as string;
  const { data: existentes } = await supabase
    .from("transactions").select("data_compra, valor_centavos").eq(origemCol, origemId);
  const chaves = new Set((existentes ?? []).map((e) => `${e.data_compra}|${e.valor_centavos}`));

  // dia de fechamento do cartão buscado uma vez para todo o lote (evita 1 SELECT por lançamento)
  let diaFechamento: number | null | undefined = undefined;
  if (origem.card_id) {
    const { data: card } = await supabase.from("cards").select("dia_fechamento").eq("id", origem.card_id).maybeSingle();
    if (!card) return NextResponse.json({ error: "cartão inexistente" }, { status: 400 });
    diaFechamento = card.dia_fechamento;
  }

  let criadas = 0;
  let duplicadas = 0;
  const falhas: string[] = [];
  for (const it of itens) {
    if (!(it.valor_centavos > 0) || !DATA_ISO.test(it.data ?? "")) {
      falhas.push(it.descricao || "(sem descrição)");
      continue;
    }
    const chave = `${it.data}|${it.valor_centavos}`;
    if (chaves.has(chave)) { duplicadas++; continue; } // já existe → pula

    const novo: NovoLancamento = {
      tipo: it.tipo, valor_centavos: it.valor_centavos, data_compra: it.data,
      categoria_id: it.categoria_id ?? null, pessoa: it.pessoa,
      account_id: origem.account_id ?? null, card_id: origem.card_id ?? null,
      total_parcelas: origem.card_id ? Math.min(72, Math.max(1, it.total_parcelas || 1)) : 1,
      descricao: it.descricao, origem_ia: true,
    };
    const { error } = await persistirLancamento(
      supabase, { householdId: membro.household_id, criadoPor: membro.user_id }, novo, diaFechamento,
    );
    if (error) falhas.push(it.descricao || "(sem descrição)");
    else { criadas++; chaves.add(chave); } // evita duplicar dentro do próprio lote
  }
  return NextResponse.json({ criadas, duplicadas, falhas });
}
