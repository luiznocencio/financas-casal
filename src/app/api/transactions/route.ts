import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";
import { persistirLancamento } from "@/lib/financeiro/persistir";
import type { NovoLancamento } from "@/lib/financeiro/tipos";

export async function POST(req: Request) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const l = (await req.json()) as NovoLancamento;
  const supabase = await createServerSupabase();

  // limita parcelas no servidor (evita amplificação: N linhas + N upserts por request)
  l.total_parcelas = Math.min(72, Math.max(1, Math.floor(Number(l.total_parcelas) || 1)));
  if (!(l.valor_centavos > 0)) return NextResponse.json({ error: "valor inválido" }, { status: 400 });

  if (l.account_id) {
    const { data: conta } = await supabase.from("accounts").select("id").eq("id", l.account_id).maybeSingle();
    if (!conta) return NextResponse.json({ error: "conta inexistente" }, { status: 400 });
  }

  const { error } = await persistirLancamento(supabase, { householdId: membro.household_id, criadoPor: membro.user_id }, l);
  if (error) {
    const status = error.includes("inexistente") ? 400 : 500;
    return NextResponse.json({ error }, { status });
  }
  return NextResponse.json({ ok: true });
}
