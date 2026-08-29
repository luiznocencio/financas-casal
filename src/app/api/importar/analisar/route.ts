import { NextResponse } from "next/server";
import { interpretarImportacao } from "@/lib/importacao/extrair";
import { marcarDuplicados } from "@/lib/importacao/duplicados";
import { chamarModeloJson } from "@/lib/ai/openai";
import { getMembroAtual } from "@/lib/auth/household";
import { createServerSupabase } from "@/lib/supabase/server";
import { normalizeDescricao } from "@/lib/financeiro/descricao";

export async function POST(req: Request) {
  // exige usuário logado antes de gastar chamada à OpenAI
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const body = await req.json();
    const texto = body?.texto;
    const origem: { card_id?: string; account_id?: string } = body?.origem ?? {};
    if (!texto || typeof texto !== "string") return NextResponse.json({ ok: false });
    const linhas = await interpretarImportacao(texto, chamarModeloJson);

    const supabase = await createServerSupabase();

    // aplica regras aprendidas (casamento exato normalizado)
    const { data: regras } = await supabase.from("category_rules").select("chave, categoria_id, descricao_preferida");
    const porChave = new Map((regras ?? []).map((r) => [r.chave, r]));
    const comRegra = linhas.map((l) => {
      const regra = porChave.get(normalizeDescricao(l.descricao));
      if (!regra) return { ...l, categoria_id: null as string | null };
      return {
        ...l,
        descricao: regra.descricao_preferida || l.descricao,
        categoria_id: regra.categoria_id as string | null,
      };
    });

    // marca o que já existe (não duplicar fatura x lançamento manual). Combina
    // (a) transações da mesma origem e (b) gastos fixos já materializados em
    // QUALQUER origem da casa (fixo lançado noutro cartão também é duplicado),
    // deduplicando por id da transação.
    const origemCol = origem.card_id ? "card_id" : origem.account_id ? "account_id" : null;
    const origemId = origem.card_id ?? origem.account_id ?? null;
    const porId = new Map<string, { data_compra: string; valor_centavos: number; tipo: string; descricao: string; recorrente: boolean }>();
    const addTx = (t: { id: string; data_compra: string; valor_centavos: number; tipo: string; descricao: string; recorrente_id: string | null }) => {
      porId.set(t.id, {
        data_compra: t.data_compra, valor_centavos: t.valor_centavos, tipo: t.tipo,
        descricao: t.descricao, recorrente: t.recorrente_id != null,
      });
    };
    if (origemCol && origemId) {
      const { data } = await supabase
        .from("transactions").select("id, data_compra, valor_centavos, tipo, descricao, recorrente_id").eq(origemCol, origemId);
      for (const t of data ?? []) addTx(t);
    }
    // gastos fixos já materializados na casa toda (RLS já limita ao household)
    const { data: recorrentes } = await supabase
      .from("transactions").select("id, data_compra, valor_centavos, tipo, descricao, recorrente_id").not("recorrente_id", "is", null);
    for (const t of recorrentes ?? []) addTx(t);

    const existentes = [...porId.values()];
    const comDup = marcarDuplicados(comRegra, existentes);

    return NextResponse.json({ ok: true, linhas: comDup });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
