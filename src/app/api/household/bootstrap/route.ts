import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Categorias padrão criadas junto com um lar novo (elimina passo de seed manual).
const CATEGORIAS_PADRAO: { nome: string; tipo: "despesa" | "receita"; cor: string }[] = [
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

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  // já é membro?
  const { data: existente } = await supabase
    .from("members").select("*").eq("user_id", auth.user.id).maybeSingle();
  if (existente) return NextResponse.json({ member: existente });

  const body = await req.json().catch(() => ({}));
  const nome: string = body.nome ?? auth.user.email ?? "Membro";
  const inviteCode: string | undefined = body.invite_code;

  let householdId: string;
  const criandoLar = !inviteCode;
  if (inviteCode) {
    // juntar a um household existente. Não dá para SELECT direto: a policy
    // household_select filtra por current_household_id(), que é NULL para quem
    // ainda não é membro. A função security definer acha o lar pelo invite_code.
    const { data: hhId, error } = await supabase
      .rpc("household_id_por_invite", { code: inviteCode });
    if (error || !hhId) return NextResponse.json({ error: "código inválido" }, { status: 400 });
    householdId = hhId as string;
  } else {
    // criar novo household
    const { data: hh, error } = await supabase
      .from("households").insert({ nome: body.nome_lar ?? "Nosso lar" }).select("id").single();
    if (error || !hh) return NextResponse.json({ error: "falha ao criar lar" }, { status: 500 });
    householdId = hh.id;
  }

  const { data: member, error: errMember } = await supabase
    .from("members")
    .insert({ user_id: auth.user.id, household_id: householdId, nome, papel: criandoLar ? "dono" : "membro" })
    .select("*").single();
  if (errMember) return NextResponse.json({ error: "falha ao criar membro" }, { status: 500 });

  // semeia categorias padrão só ao criar um lar novo (agora current_household_id() já resolve)
  if (criandoLar) {
    await supabase.from("categories").insert(
      CATEGORIAS_PADRAO.map((c) => ({ ...c, household_id: householdId })),
    );
  }

  // devolve o invite_code para o dono compartilhar com o parceiro(a)
  const { data: lar } = await supabase
    .from("households").select("invite_code").eq("id", householdId).maybeSingle();

  return NextResponse.json({ member, invite_code: lar?.invite_code ?? null });
}
