import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";
import { enviarPush } from "@/lib/push/webpush";

export const runtime = "nodejs";

// Manda um aviso de teste pros aparelhos de quem está logado (só os dele).
export async function POST() {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });

  const supabase = await createServerSupabase();
  const { data: subs, error } = await supabase
    .from("push_subscriptions").select("endpoint, p256dh, auth").eq("criado_por", membro.user_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!subs?.length) return NextResponse.json({ ok: false, enviadas: 0, motivo: "nenhum aparelho com avisos ativos" });

  const resultados = await Promise.all(subs.map((s) => enviarPush(s, {
    title: `🔔 ${membro.nome}, seus avisos estão funcionando`,
    body: "Você vai receber o fechamento e o vencimento dos seus cartões, contas a pagar e o orçamento.",
    url: "/",
    tag: "teste",
    tipo: "geral",
  })));
  const expiradas = subs.filter((_, i) => resultados[i].expirada).map((s) => s.endpoint);
  if (expiradas.length) await supabase.from("push_subscriptions").delete().in("endpoint", expiradas);
  return NextResponse.json({ ok: true, enviadas: resultados.filter((r) => r.ok).length });
}
