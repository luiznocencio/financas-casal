import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

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
  if (inviteCode) {
    // juntar a um household existente
    const { data: hh, error } = await supabase
      .from("households").select("id").eq("invite_code", inviteCode).maybeSingle();
    if (error || !hh) return NextResponse.json({ error: "código inválido" }, { status: 400 });
    householdId = hh.id;
  } else {
    // criar novo household
    const { data: hh, error } = await supabase
      .from("households").insert({ nome: body.nome_lar ?? "Nosso lar" }).select("id").single();
    if (error || !hh) return NextResponse.json({ error: "falha ao criar lar" }, { status: 500 });
    householdId = hh.id;
  }

  const { data: member, error: errMember } = await supabase
    .from("members")
    .insert({ user_id: auth.user.id, household_id: householdId, nome, papel: inviteCode ? "membro" : "dono" })
    .select("*").single();
  if (errMember) return NextResponse.json({ error: "falha ao criar membro" }, { status: 500 });

  return NextResponse.json({ member });
}
