import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServiceSupabase } from "@/lib/supabase/service";
import { enviarPush } from "@/lib/push/webpush";
import { faturaFechaNaData, partesNoFuso, diaSeguinte, ultimoDiaDoMes } from "@/lib/financeiro/fechamento";

const pad = (n: number) => String(n).padStart(2, "0");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FUSO = "America/Sao_Paulo";

// compara o bearer em tempo constante (evita vazar o segredo por timing)
function autorizado(auth: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !auth) return false;
  const a = Buffer.from(auth);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Roda 1x/dia (Vercel Cron). Avisa quando a fatura de um cartão fecha AMANHÃ.
export async function GET(req: Request) {
  // só a Vercel Cron (ou quem tiver o segredo) pode disparar
  if (!autorizado(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  // ?forcar=1 → dispara um teste pra cada dispositivo, ignorando a data
  const forcar = new URL(req.url).searchParams.get("forcar") === "1";

  // "amanhã" no fuso do casal (o cron roda em UTC)
  const hoje = partesNoFuso(new Date(), FUSO);
  const amanha = diaSeguinte(hoje.ano, hoje.mes, hoje.dia);

  const supabase = createServiceSupabase();
  const iniMes = `${hoje.ano}-${pad(hoje.mes)}-01`;
  const fimMes = `${hoje.ano}-${pad(hoje.mes)}-${pad(ultimoDiaDoMes(hoje.ano, hoje.mes))}`;
  const [cardsRes, subsRes, contasRes, pagasRes] = await Promise.all([
    supabase.from("cards").select("id, nome, dia_fechamento, household_id"),
    supabase.from("push_subscriptions").select("household_id, endpoint, p256dh, auth"),
    supabase.from("contas_pagar").select("id, descricao, dia_vencimento, household_id").eq("ativo", true),
    supabase.from("transactions").select("conta_pagar_id").not("conta_pagar_id", "is", null)
      .gte("data_compra", iniMes).lte("data_compra", fimMes),
  ]);
  if (cardsRes.error || subsRes.error || contasRes.error || pagasRes.error) {
    return NextResponse.json(
      { error: cardsRes.error?.message ?? subsRes.error?.message ?? contasRes.error?.message ?? pagasRes.error?.message },
      { status: 500 },
    );
  }

  const cartoes = cardsRes.data ?? [];
  const subs = subsRes.data ?? [];
  const fechandoAmanha = cartoes.filter((c) =>
    faturaFechaNaData(c.dia_fechamento, amanha.ano, amanha.mes, amanha.dia),
  );

  // contas a pagar que vencem HOJE e ainda não foram pagas neste mês
  const pagasMes = new Set((pagasRes.data ?? []).map((t) => t.conta_pagar_id));
  const vencendoHoje = (contasRes.data ?? []).filter((c) =>
    !pagasMes.has(c.id) && Math.min(c.dia_vencimento, ultimoDiaDoMes(hoje.ano, hoje.mes)) === hoje.dia,
  );

  // teste: 1 notificação por dispositivo. real: 1 por (cartão que fecha amanhã × dispositivo).
  type Tarefa = { s: (typeof subs)[number]; payload: Parameters<typeof enviarPush>[1] };
  const tarefas: Tarefa[] = forcar
    ? subs.map((s) => ({
        s,
        payload: {
          title: "Teste de notificação ✅",
          body: "Se você recebeu isso, os avisos de fatura estão funcionando.",
          url: "/cartoes",
          tag: "teste",
        },
      }))
    : [
        ...fechandoAmanha.flatMap((card) =>
          subs
            .filter((s) => s.household_id === card.household_id)
            .map((s) => ({
              s,
              payload: {
                title: "Fatura fechando amanhã",
                body: `A fatura do ${card.nome} fecha amanhã. Confira os gastos antes de fechar.`,
                url: "/cartoes",
                tag: `fatura-${card.id}`,
              },
            })),
        ),
        ...vencendoHoje.flatMap((conta) =>
          subs
            .filter((s) => s.household_id === conta.household_id)
            .map((s) => ({
              s,
              payload: {
                title: "Conta vence hoje",
                body: `${conta.descricao} vence hoje. Não esqueça de pagar.`,
                url: "/planejamento?aba=contas",
                tag: `conta-${conta.id}`,
              },
            })),
        ),
      ];

  const resultados = await Promise.all(
    tarefas.map(({ s, payload }) =>
      enviarPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload)
        .then((r) => ({ r, endpoint: s.endpoint })),
    ),
  );
  let enviadas = 0;
  const expirados: string[] = [];
  for (const { r, endpoint } of resultados) {
    if (r.ok) enviadas++;
    if (r.expirada) expirados.push(endpoint);
  }

  // limpa assinaturas que o Push Service reportou como mortas
  if (expirados.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", expirados);
  }

  return NextResponse.json({
    ok: true,
    forcar,
    amanha,
    dispositivos: subs.length,
    cartoesFechando: fechandoAmanha.length,
    contasVencendo: vencendoHoje.length,
    enviadas,
    removidas: expirados.length,
  });
}
