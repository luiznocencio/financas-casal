import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServiceSupabase } from "@/lib/supabase/service";
import { enviarPush } from "@/lib/push/webpush";
import { faturaFechaNaData, partesNoFuso, diaSeguinte, ultimoDiaDoMes } from "@/lib/financeiro/fechamento";
import { contaOcorreNoMes } from "@/lib/financeiro/contas";
import { orcamentoDoMes, type EstadoOrc } from "@/lib/financeiro/projecao";
import { centavosParaReais } from "@/lib/financeiro/dinheiro";

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

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
// atenção (90%) < vai passar (projeção) < estourou — só avisa quando o estado SOBE
const RANK: Record<EstadoOrc, number> = { ok: 0, atencao: 1, vai_estourar: 2, estourou: 3 };

// Roda 1x/dia (Vercel Cron). Avisa quando a fatura de um cartão fecha AMANHÃ,
// quando uma conta vence amanhã e quando uma categoria do orçamento chega a 90%,
// vai passar do limite (com o que ainda vai cair) ou estourou.
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
  // janela de pagamentos: mês atual + mês seguinte (cobre um vencimento que cai amanhã já no próximo mês)
  const iniMes = `${hoje.ano}-${pad(hoje.mes)}-01`;
  const fimMes = `${amanha.ano}-${pad(amanha.mes)}-${pad(ultimoDiaDoMes(amanha.ano, amanha.mes))}`;
  const [cardsRes, subsRes, contasRes, pagasRes, orcRes] = await Promise.all([
    supabase.from("cards").select("id, nome, dia_fechamento, household_id"),
    supabase.from("push_subscriptions").select("household_id, endpoint, p256dh, auth"),
    supabase.from("contas_pagar").select("id, descricao, dia_vencimento, household_id, recorrencia, data_fim, created_at").eq("ativo", true),
    supabase.from("transactions").select("conta_pagar_id").not("conta_pagar_id", "is", null)
      .gte("data_compra", iniMes).lte("data_compra", fimMes),
    // falha no orçamento não pode derrubar os avisos de fatura/conta
    forcar ? Promise.resolve(null) : carregarOrcamentos(supabase).catch(() => null),
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

  // contas a pagar que vencem AMANHÃ (um dia de antecedência) e ainda não foram pagas
  const pagasMes = new Set((pagasRes.data ?? []).map((t) => t.conta_pagar_id));
  const vencendoAmanha = (contasRes.data ?? []).filter((c) =>
    !pagasMes.has(c.id)
    && Math.min(c.dia_vencimento, ultimoDiaDoMes(amanha.ano, amanha.mes)) === amanha.dia
    && contaOcorreNoMes(c, amanha.ano, amanha.mes),
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
        ...vencendoAmanha.flatMap((conta) =>
          subs
            .filter((s) => s.household_id === conta.household_id)
            .map((s) => ({
              s,
              payload: {
                title: "Conta vence amanhã",
                body: `${conta.descricao} vence amanhã. Já deixa pago pra não esquecer.`,
                url: "/planejamento?aba=contas",
                tag: `conta-${conta.id}`,
              },
            })),
        ),
      ];

  // orçamento: um aviso por categoria/mês/estado, só quando o estado piora
  const novosAlertas: { household_id: string; chave: string }[] = [];
  if (orcRes && !forcar) {
    const mesChave = `${hoje.ano}-${pad(hoje.mes)}`;
    const { data: jaEnviados } = await supabase.from("alertas_enviados").select("household_id, chave").like("chave", `orc:%:${mesChave}:%`);
    const enviado = new Map<string, number>(); // household|cat -> maior rank já avisado
    for (const a of jaEnviados ?? []) {
      const [, cat, , estado] = a.chave.split(":");
      const k = `${a.household_id}|${cat}`;
      enviado.set(k, Math.max(enviado.get(k) ?? 0, RANK[estado as EstadoOrc] ?? 0));
    }
    for (const hh of new Set(subs.map((s) => s.household_id))) {
      const d = orcRes.porCasa(hh);
      const orc = orcamentoDoMes({ ano: hoje.ano, mes: hoje.mes }, d);
      const nome = new Map(d.cats.map((c) => [c.id, c.nome]));
      for (const i of orc.itens) {
        if (i.estado === "ok" || RANK[i.estado] <= (enviado.get(`${hh}|${i.categoria_id}`) ?? 0)) continue;
        const cat = nome.get(i.categoria_id) ?? "Categoria";
        const payload = i.estado === "estourou"
          ? { title: `${cat} estourou o orçamento`, body: `Gasto ${centavosParaReais(i.gasto)} de ${centavosParaReais(i.limite)} em ${MESES[hoje.mes - 1]} — ${centavosParaReais(i.excesso)} acima.` }
          : i.estado === "vai_estourar"
            ? { title: `${cat} vai passar do limite`, body: `Com o que ainda vai cair, fecha em ${centavosParaReais(i.projetado)} — ${centavosParaReais(i.excesso)} acima de ${centavosParaReais(i.limite)}.` }
            : { title: `${cat} chegou a 90% do orçamento`, body: `Já foram ${centavosParaReais(i.gasto)} de ${centavosParaReais(i.limite)} em ${MESES[hoje.mes - 1]}.` };
        for (const s of subs.filter((x) => x.household_id === hh)) {
          tarefas.push({ s, payload: { ...payload, url: "/orcamento", tag: `orc-${i.categoria_id}` } });
        }
        novosAlertas.push({ household_id: hh, chave: `orc:${i.categoria_id}:${mesChave}:${i.estado}` });
      }
    }
  }

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

  if (novosAlertas.length) {
    await supabase.from("alertas_enviados").upsert(novosAlertas, { onConflict: "household_id,chave", ignoreDuplicates: true });
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
    contasVencendo: vencendoAmanha.length,
    alertasOrcamento: novosAlertas.length,
    enviadas,
    removidas: expirados.length,
  });
}

// Dados do orçamento de todas as casas (o cron roda sem sessão, com service role),
// agrupados por household pra calcular o orçamento projetado de cada uma.
async function carregarOrcamentos(supabase: ReturnType<typeof createServiceSupabase>) {
  const [cats, budgets, txs, invoices, fixos, contas] = await Promise.all([
    supabase.from("categories").select("id, nome, parent_id, household_id").eq("tipo", "despesa"),
    supabase.from("budgets").select("categoria_id, valor_centavos, household_id"),
    supabase.from("transactions").select("household_id, tipo, valor_centavos, pessoa, categoria_id, data_compra, card_id, account_id, invoice_id, total_parcelas, recorrente_id, conta_pagar_id, descricao"),
    supabase.from("invoices").select("id, competencia_ano, competencia_mes, household_id"),
    supabase.from("recorrentes").select("id, descricao, valor_centavos, categoria_id, dia, card_id, account_id, data_fim, ativo, household_id").eq("ativo", true),
    supabase.from("contas_pagar").select("id, descricao, categoria_id, valor_estimado_centavos, dia_vencimento, recorrencia, data_fim, created_at, household_id").eq("ativo", true),
  ]);
  const erro = cats.error ?? budgets.error ?? txs.error ?? invoices.error ?? fixos.error ?? contas.error;
  if (erro) throw new Error(erro.message);
  const de = <T extends { household_id: string }>(rows: T[] | null, hh: string) => (rows ?? []).filter((r) => r.household_id === hh);
  return {
    porCasa: (hh: string) => ({
      cats: de(cats.data, hh), budgets: de(budgets.data, hh), txs: de(txs.data, hh),
      invoices: de(invoices.data, hh), fixos: de(fixos.data, hh), contas: de(contas.data, hh),
    }),
  };
}
