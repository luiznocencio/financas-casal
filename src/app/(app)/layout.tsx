import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";
import { QuickAdd } from "@/components/quick-add/QuickAdd";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();

  // guardas: sem login -> /login; logado sem lar -> /onboarding
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const membro = await getMembroAtual();
  if (!membro) redirect("/onboarding");

  const [cardsRes, contasRes, catsRes, membrosRes] = await Promise.all([
    supabase.from("cards").select("*").order("nome"),
    supabase.from("accounts").select("*").order("nome"),
    supabase.from("categories").select("*").order("nome"),
    supabase.from("members").select("nome"),
  ]);
  const erroShell = cardsRes.error ?? contasRes.error ?? catsRes.error ?? membrosRes.error;
  if (erroShell) throw new Error(`Falha ao carregar dados do app: ${erroShell.message}`);
  const cartoes = cardsRes.data;
  const contas = contasRes.data;
  const categorias = catsRes.data;
  const membros = membrosRes.data;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 16, paddingBottom: 96 }}>
      <nav style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        <Link href="/">Início</Link>
        <Link href="/cartoes">Cartões</Link>
        <Link href="/contas">Contas</Link>
        <Link href="/lancamentos">Extrato</Link>
      </nav>
      {children}
      <QuickAdd
        cartoes={cartoes ?? []} contas={contas ?? []}
        categorias={categorias ?? []} membros={(membros ?? []).map((m) => m.nome)}
      />
    </div>
  );
}
