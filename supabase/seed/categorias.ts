import { createClient } from "@supabase/supabase-js";

const PADRAO: { nome: string; tipo: "despesa" | "receita"; cor: string }[] = [
  { nome: "Mercado", tipo: "despesa", cor: "#2f9e44" },
  { nome: "Alimentação", tipo: "despesa", cor: "#e8590c" },
  { nome: "Transporte", tipo: "despesa", cor: "#1971c2" },
  { nome: "Contas de casa", tipo: "despesa", cor: "#6741d9" },
  { nome: "Saúde", tipo: "despesa", cor: "#c2255c" },
  { nome: "Lazer", tipo: "despesa", cor: "#f08c00" },
  { nome: "Compras", tipo: "despesa", cor: "#9c36b5" },
  { nome: "Salário", tipo: "receita", cor: "#2b8a3e" },
  { nome: "Outros", tipo: "despesa", cor: "#6b7280" },
];

async function main() {
  const householdId = process.argv[2];
  if (!householdId) throw new Error("uso: tsx seed/categorias.ts <household_id>");
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const linhas = PADRAO.map((c) => ({ ...c, household_id: householdId }));
  const { error } = await admin.from("categories").insert(linhas);
  if (error) throw error;
  console.log(`Inseridas ${linhas.length} categorias no household ${householdId}`);
}
main();
