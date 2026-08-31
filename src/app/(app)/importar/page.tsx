import { createServerSupabase } from "@/lib/supabase/server";
import { Importador } from "@/components/importar/Importador";
import { ImportacoesRecentes, type LoteImportacao } from "@/components/importar/ImportacoesRecentes";

export default async function ImportarPage() {
  const supabase = await createServerSupabase();
  const [{ data: cartoes }, { data: contas }, { data: categorias }, { data: membros }, { data: importadas }] = await Promise.all([
    supabase.from("cards").select("id, nome, titular").order("nome"),
    supabase.from("accounts").select("id, nome, titular").order("nome"),
    supabase.from("categories").select("id, nome, parent_id"),
    supabase.from("members").select("nome"),
    supabase.from("transactions")
      .select("grupo_importacao, valor_centavos, created_at, card_id, account_id")
      .not("grupo_importacao", "is", null),
  ]);

  const nomeCartao = new Map((cartoes ?? []).map((c) => [c.id, c.nome]));
  const nomeConta = new Map((contas ?? []).map((c) => [c.id, c.nome]));
  const origemDe = (t: { card_id: string | null; account_id: string | null }) =>
    t.card_id ? `Cartão · ${nomeCartao.get(t.card_id) ?? "?"}`
      : t.account_id ? `Conta · ${nomeConta.get(t.account_id) ?? "?"}` : null;

  const porGrupo = new Map<string, LoteImportacao>();
  for (const t of importadas ?? []) {
    const grupo = t.grupo_importacao as string;
    const atual = porGrupo.get(grupo);
    if (!atual) {
      porGrupo.set(grupo, {
        grupo, quantidade: 1, totalCentavos: t.valor_centavos, dataMaisRecente: t.created_at,
        origemNome: origemDe(t),
      });
    } else {
      atual.quantidade += 1;
      atual.totalCentavos += t.valor_centavos;
      if (t.created_at > atual.dataMaisRecente) atual.dataMaisRecente = t.created_at;
    }
  }
  const lotes = [...porGrupo.values()]
    .sort((a, b) => (a.dataMaisRecente < b.dataMaisRecente ? 1 : -1))
    .slice(0, 10);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-[var(--text)]">Importar lançamentos</h1>
      <Importador
        cartoes={cartoes ?? []} contas={contas ?? []}
        categorias={categorias ?? []} membros={(membros ?? []).map((m) => m.nome)}
      />
      <ImportacoesRecentes lotes={lotes} cartoes={cartoes ?? []} />
    </main>
  );
}
