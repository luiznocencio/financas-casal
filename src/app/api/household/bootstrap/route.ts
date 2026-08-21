import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Cria OU entra num lar. Toda a lógica roda na função SQL `bootstrap_lar`
// (security definer) — o INSERT do household via cliente RLS falha porque
// quem ainda não é membro não passa nas policies.
export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const nome: string = body.nome ?? auth.user.email ?? "Membro";

  const { data, error } = await supabase.rpc("bootstrap_lar", {
    p_invite_code: body.invite_code ?? null,
    p_nome_membro: nome,
    p_nome_lar: body.nome_lar ?? "Nosso lar",
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("código inválido"))
      return NextResponse.json({ error: "código inválido" }, { status: 400 });
    if (msg.includes("limite de 2"))
      return NextResponse.json({ error: "este lar já tem 2 membros" }, { status: 400 });
    return NextResponse.json({ error: "não foi possível concluir" }, { status: 500 });
  }

  return NextResponse.json(data);
}
