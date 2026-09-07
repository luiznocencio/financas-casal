import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";
import { nomeBase, nomeComMarcador } from "@/lib/importacao/parcelas";

// Ações sobre compras parceladas (aba Parcelas):
// - renomear: troca o nome de todas as parcelas da compra preservando o marcador,
//   e aprende o nome pro futuro (regra por nome base) SEM quebrar o vínculo.
// - mesclar: junta lançamentos de compras que o sistema separou (texto do banco
//   variou) num único grupo_parcela.
export async function POST(req: Request) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const acao: string = body?.acao;
  const txIds: string[] = Array.isArray(body?.txIds) ? body.txIds.filter((x: unknown) => typeof x === "string") : [];
  if (!txIds.length) return NextResponse.json({ error: "sem lançamentos" }, { status: 400 });

  const supabase = await createServerSupabase();
  // RLS limita ao household; confere que os ids existem antes de agir
  const { data: txs, error } = await supabase
    .from("transactions").select("id, descricao, grupo_parcela").in("id", txIds);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!txs?.length) return NextResponse.json({ error: "lançamentos inexistentes" }, { status: 400 });

  if (acao === "renomear") {
    const nome = typeof body?.nome === "string" ? body.nome.trim() : "";
    if (!nome) return NextResponse.json({ error: "nome vazio" }, { status: 400 });
    // renomeia cada parcela preservando seu marcador ("Reforma 9/10", "Reforma 10/10")
    for (const t of txs) {
      await supabase.from("transactions").update({ descricao: nomeComMarcador(nome, t.descricao ?? "") }).eq("id", t.id);
    }
    // aprende o nome pro futuro: uma regra por variação do texto do banco que a
    // compra teve, todas apontando pro mesmo nome (não mexe na categoria existente)
    const bases = [...new Set(txs.map((t) => nomeBase(t.descricao ?? "")).filter(Boolean))];
    for (const chave of bases) {
      const { data: regra } = await supabase
        .from("category_rules").select("categoria_id")
        .eq("household_id", membro.household_id).eq("chave", chave).maybeSingle();
      await supabase.from("category_rules").upsert(
        { household_id: membro.household_id, chave, categoria_id: regra?.categoria_id ?? null, descricao_preferida: nome },
        { onConflict: "household_id,chave" },
      );
    }
    return NextResponse.json({ ok: true, renomeadas: txs.length });
  }

  if (acao === "mesclar") {
    if (txs.length < 2) return NextResponse.json({ error: "selecione ao menos duas" }, { status: 400 });
    // grupo canônico: reaproveita um já existente entre os selecionados, senão cria
    const grupo = txs.find((t) => t.grupo_parcela)?.grupo_parcela ?? crypto.randomUUID();
    const { error: errUp } = await supabase.from("transactions").update({ grupo_parcela: grupo }).in("id", txs.map((t) => t.id));
    if (errUp) return NextResponse.json({ error: errUp.message }, { status: 500 });
    return NextResponse.json({ ok: true, grupo, mescladas: txs.length });
  }

  return NextResponse.json({ error: "ação inválida" }, { status: 400 });
}
