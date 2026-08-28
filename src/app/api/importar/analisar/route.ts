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

    // marca o que já existe na mesma origem (não duplicar fatura x lançamento manual)
    const origemCol = origem.card_id ? "card_id" : origem.account_id ? "account_id" : null;
    const origemId = origem.card_id ?? origem.account_id ?? null;
    let existentes: { data_compra: string; valor_centavos: number; tipo: string }[] = [];
    if (origemCol && origemId) {
      const { data } = await supabase
        .from("transactions").select("data_compra, valor_centavos, tipo").eq(origemCol, origemId);
      existentes = data ?? [];
    }
    const comDup = marcarDuplicados(comRegra, existentes);

    return NextResponse.json({ ok: true, linhas: comDup });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
