import { NextResponse } from "next/server";
import { interpretarImportacao } from "@/lib/importacao/extrair";
import { chamarModeloJson } from "@/lib/ai/openai";
import { getMembroAtual } from "@/lib/auth/household";
import { createServerSupabase } from "@/lib/supabase/server";
import { normalizeDescricao } from "@/lib/financeiro/descricao";

export async function POST(req: Request) {
  // exige usuário logado antes de gastar chamada à OpenAI
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const { texto } = await req.json();
    if (!texto || typeof texto !== "string") return NextResponse.json({ ok: false });
    const linhas = await interpretarImportacao(texto, chamarModeloJson);

    // aplica regras aprendidas (casamento exato normalizado)
    const supabase = await createServerSupabase();
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

    return NextResponse.json({ ok: true, linhas: comRegra });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
