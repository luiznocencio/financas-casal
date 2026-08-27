import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";
import { normalizeDescricao } from "@/lib/financeiro/descricao";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const descricao: string | null = typeof body.descricao === "string" ? body.descricao : null;
  const categoria_id: string | null = body.categoria_id ?? null;
  const supabase = await createServerSupabase();

  // descrição atual (base da regra — o texto que reaparece nas faturas)
  const { data: atual } = await supabase.from("transactions").select("descricao").eq("id", id).maybeSingle();
  if (!atual) return NextResponse.json({ error: "lançamento inexistente" }, { status: 400 });

  // atualiza o próprio lançamento
  const { error: errUp } = await supabase.from("transactions").update({ descricao, categoria_id }).eq("id", id);
  if (errUp) return NextResponse.json({ error: errUp.message }, { status: 500 });

  // aprende a regra e aplica retroativamente
  const chave = normalizeDescricao(atual.descricao ?? descricao ?? "");
  let aplicadas = 0;
  if (categoria_id && chave) {
    await supabase.from("category_rules").upsert(
      { household_id: membro.household_id, chave, categoria_id, descricao_preferida: descricao },
      { onConflict: "household_id,chave" },
    );
    // retroativo: todos os lançamentos do household que casam pela chave
    const { data: todos } = await supabase.from("transactions").select("id, descricao");
    const idsCasando = (todos ?? [])
      .filter((t) => t.id !== id && normalizeDescricao(t.descricao ?? "") === chave)
      .map((t) => t.id);
    if (idsCasando.length > 0) {
      const patch: { categoria_id: string; descricao?: string } = { categoria_id };
      if (descricao) patch.descricao = descricao;
      await supabase.from("transactions").update(patch).in("id", idsCasando);
      aplicadas = idsCasando.length;
    }
  }
  return NextResponse.json({ ok: true, aplicadas });
}
