import { createServerSupabase } from "@/lib/supabase/server";
import { Importador } from "@/components/importar/Importador";

export default async function ImportarPage() {
  const supabase = await createServerSupabase();
  const [{ data: cartoes }, { data: contas }, { data: categorias }, { data: membros }] = await Promise.all([
    supabase.from("cards").select("id, nome").order("nome"),
    supabase.from("accounts").select("id, nome").order("nome"),
    supabase.from("categories").select("id, nome"),
    supabase.from("members").select("nome"),
  ]);
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-[var(--text)]">Importar lançamentos</h1>
      <Importador
        cartoes={cartoes ?? []} contas={contas ?? []}
        categorias={categorias ?? []} membros={(membros ?? []).map((m) => m.nome)}
      />
    </main>
  );
}
