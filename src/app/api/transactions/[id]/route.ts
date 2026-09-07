import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";
import { nomeBase, nomeComMarcador } from "@/lib/importacao/parcelas";

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

  // atualiza o próprio lançamento (observação é específica desta compra — não vira regra)
  const patchTx: Record<string, unknown> = { descricao, categoria_id };
  if ("observacao" in body) {
    patchTx.observacao = typeof body.observacao === "string" && body.observacao.trim() ? body.observacao.trim() : null;
  }
  const { error: errUp } = await supabase.from("transactions").update(patchTx).eq("id", id);
  if (errUp) return NextResponse.json({ error: errUp.message }, { status: 500 });

  // aprende a regra e aplica retroativamente. A chave é o NOME BASE (sem marcador
  // de parcela e sem código de loja variável), pra pegar a mesma compra em faturas
  // diferentes: renomear a parcela 9/10 aprende o nome pra 10/10 e futuras. A regra
  // guarda nome E/OU categoria (renomear sem taggear, ou vice-versa).
  const chave = nomeBase(atual.descricao ?? descricao ?? "");
  let aplicadas = 0;
  if ((categoria_id || descricao) && chave) {
    // merge: não apaga o campo que não veio nesta edição
    const { data: regraAtual } = await supabase
      .from("category_rules").select("categoria_id, descricao_preferida")
      .eq("household_id", membro.household_id).eq("chave", chave).maybeSingle();
    const catRegra = categoria_id ?? regraAtual?.categoria_id ?? null;
    const nomeRegra = descricao ?? regraAtual?.descricao_preferida ?? null;
    await supabase.from("category_rules").upsert(
      { household_id: membro.household_id, chave, categoria_id: catRegra, descricao_preferida: nomeRegra },
      { onConflict: "household_id,chave" },
    );
    // retroativo: todos os lançamentos do household que casam pelo nome base
    const { data: todos } = await supabase.from("transactions").select("id, descricao");
    const casando = (todos ?? []).filter((t) => t.id !== id && nomeBase(t.descricao ?? "") === chave);
    for (const t of casando) {
      const patch: { categoria_id?: string; descricao?: string } = {};
      if (catRegra) patch.categoria_id = catRegra;
      // preserva o marcador de cada parcela ("Reforma 9/10", "Reforma 10/10")
      if (nomeRegra) patch.descricao = nomeComMarcador(nomeRegra, t.descricao ?? "");
      if (Object.keys(patch).length) await supabase.from("transactions").update(patch).eq("id", t.id);
    }
    aplicadas = casando.length;
  }
  return NextResponse.json({ ok: true, aplicadas });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const { id } = await params;
  const supabase = await createServerSupabase();

  // se for uma perna de transferência, apaga o par inteiro (mantém o saldo íntegro)
  const { data: alvo } = await supabase.from("transactions").select("grupo_transferencia").eq("id", id).maybeSingle();
  if (alvo?.grupo_transferencia) {
    const { error } = await supabase.from("transactions").delete().eq("grupo_transferencia", alvo.grupo_transferencia);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
