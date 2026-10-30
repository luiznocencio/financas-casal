import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServiceSupabase } from "@/lib/supabase/service";
import { enviarPush } from "@/lib/push/webpush";
import { partesNoFuso, diaSeguinte, ultimoDiaDoMes } from "@/lib/financeiro/fechamento";
import { faturaFechaNoDia, vencimentoDaFatura } from "@/lib/financeiro/fatura";
import { valorNaFatura } from "@/lib/financeiro/faturas";
import { contaOcorreNoMes } from "@/lib/financeiro/contas";
import { orcamentoDoMes, type EstadoOrc } from "@/lib/financeiro/projecao";
import { centavosParaReais } from "@/lib/financeiro/dinheiro";
import { todas } from "@/lib/supabase/todas";

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

// Roda 1x/dia (Vercel Cron). Avisa quando a fatura de um cartão fecha ou vence
// AMANHÃ (só pro dono do cartão, pelo nome), quando uma conta vence amanhã e quando uma categoria do orçamento chega a 90%,
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
  const [cardsRes, subsRes, contasRes, pagasRes, orcRes, membrosRes, faturasRes] = await Promise.all([
    supabase.from("cards").select("id, nome, titular, dia_fechamento, dia_vencimento, dias_fechamento_antes, household_id"),
    supabase.from("push_subscriptions").select("household_id, endpoint, p256dh, auth, criado_por"),
    supabase.from("contas_pagar").select("id, descricao, dia_vencimento, household_id, recorrencia, data_fim, created_at").eq("ativo", true),
    // contas já quitadas no mês do vencimento de amanhã (pelo mês que o pagamento quita)
    supabase.from("transactions").select("conta_pagar_id").not("conta_pagar_id", "is", null)
      .eq("conta_pagar_ref", `${amanha.ano}-${pad(amanha.mes)}`),
    // falha no orçamento não pode derrubar os avisos de fatura/conta
    forcar ? Promise.resolve(null) : carregarOrcamentos(supabase).catch(() => null),
    supabase.from("members").select("user_id, nome, household_id"),
    // faturas em aberto que vencem no mês de amanhã (aviso de vencimento)
    supabase.from("invoices").select("id, card_id, competencia_ano, competencia_mes, status")
      .eq("competencia_ano", amanha.ano).eq("competencia_mes", amanha.mes).neq("status", "paga"),
  ]);
  const erroBase = cardsRes.error ?? subsRes.error ?? contasRes.error ?? pagasRes.error ?? membrosRes.error ?? faturasRes.error;
  if (erroBase) {
    return NextResponse.json(
      { error: erroBase.message },
      { status: 500 },
    );
  }

  const cartoes = cardsRes.data ?? [];
  const subs = subsRes.data ?? [];
  // fechamento pelo calendário real (N dias antes do vencimento de cada fatura)
  const fechandoAmanha = cartoes.filter((c) => faturaFechaNoDia(c, amanha));

  // fatura (não paga, com valor) que vence amanhã
  const faturasMes = faturasRes.data ?? [];
  const { data: itensFatura, error: errItens } = faturasMes.length
    ? await supabase.from("transactions").select("invoice_id, valor_centavos, tipo").in("invoice_id", faturasMes.map((f) => f.id))
    : { data: [], error: null };
  if (errItens) return NextResponse.json({ error: errItens.message }, { status: 500 });
  const totalFatura = new Map<string, number>();
  for (const t of itensFatura ?? []) totalFatura.set(t.invoice_id!, (totalFatura.get(t.invoice_id!) ?? 0) + valorNaFatura(t));
  const vencendoCartao = cartoes.flatMap((card) => {
    const v = vencimentoDaFatura(card, { ano: amanha.ano, mes: amanha.mes });
    if (v.dia !== amanha.dia) return [];
    const fat = faturasMes.find((f) => f.card_id === card.id);
    const total = fat ? totalFatura.get(fat.id) ?? 0 : 0;
    return total > 0 ? [{ card, total }] : [];
  });

  // aviso de cartão vai só pro dono (titular), com o nome dele; cartão sem
  // titular do lar avisa a casa toda
  const membros = membrosRes.data ?? [];
  const destinoDoCartao = (card: (typeof cartoes)[number]) => {
    const dono = membros.find((m) => m.household_id === card.household_id && m.nome === card.titular);
    return {
      nome: dono?.nome ?? null,
      subs: subs.filter((s) => s.household_id === card.household_id && (!dono || s.criado_por === dono.user_id)),
    };
  };
  // "Luiz, seu Itaú" (o titular desambigua os dois Nubank)
  const seuCartao = (nome: string | null, card: (typeof cartoes)[number]) =>
    nome ? `${nome}, seu ${card.nome}` : `O ${card.nome}`;

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
          title: "🔔 Teste de notificação",
          body: "Se você recebeu isso, os avisos estão funcionando: faturas, contas e orçamento.",
          url: "/",
          tag: "teste",
          tipo: "geral" as const,
        },
      }))
    : [
        ...fechandoAmanha.flatMap((card) => {
          const { nome, subs: alvo } = destinoDoCartao(card);
          return alvo.map((s) => ({
            s,
            payload: {
              title: `💳 ${seuCartao(nome, card)} fecha amanhã`,
              body: "Confira os gastos da fatura antes de fechar.",
              url: "/cartoes",
              tag: `fatura-${card.id}`,
              tipo: "fatura" as const,
            },
          }));
        }),
        ...vencendoCartao.flatMap(({ card, total }) => {
          const { nome, subs: alvo } = destinoDoCartao(card);
          return alvo.map((s) => ({
            s,
            payload: {
              title: `💳 ${nome ? `${nome}, a fatura do seu ${card.nome}` : `A fatura do ${card.nome}`} vence amanhã`,
              body: `${centavosParaReais(total)} pra pagar. Já deixa pago pra não esquecer.`,
              url: "/cartoes",
              tag: `vencimento-${card.id}`,
              tipo: "fatura" as const,
            },
          }));
        }),
        ...vencendoAmanha.flatMap((conta) =>
          subs
            .filter((s) => s.household_id === conta.household_id)
            .map((s) => ({
              s,
              payload: {
                title: "📅 Conta vence amanhã",
                body: `${conta.descricao} vence amanhã. Já deixa pago pra não esquecer.`,
                url: "/planejamento?aba=contas",
                tag: `conta-${conta.id}`,
                tipo: "conta" as const,
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
      const orc = orcamentoDoMes({ ano: hoje.ano, mes: hoje.mes }, { ...d, hoje: { ano: hoje.ano, mes: hoje.mes } });
      const nome = new Map(d.cats.map((c) => [c.id, c.nome]));
      for (const i of orc.itens) {
        if (i.estado === "ok" || RANK[i.estado] <= (enviado.get(`${hh}|${i.categoria_id}`) ?? 0)) continue;
        const cat = nome.get(i.categoria_id) ?? "Categoria";
        const payload = i.estado === "estourou"
          ? { tipo: "orcamento-estourou" as const, title: `🚨 ${cat} estourou o orçamento`, body: `Gasto ${centavosParaReais(i.gasto)} de ${centavosParaReais(i.limite)} em ${MESES[hoje.mes - 1]} — ${centavosParaReais(i.excesso)} acima.` }
          : i.estado === "vai_estourar"
            ? { tipo: "orcamento-vai-passar" as const, title: `📈 ${cat} vai passar do limite`, body: `Com o que ainda vai cair, fecha em ${centavosParaReais(i.projetado)} — ${centavosParaReais(i.excesso)} acima de ${centavosParaReais(i.limite)}.` }
            : { tipo: "orcamento-atencao" as const, title: `⚠️ ${cat} chegou a 90% do orçamento`, body: `Já foram ${centavosParaReais(i.gasto)} de ${centavosParaReais(i.limite)} em ${MESES[hoje.mes - 1]}.` };
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
    faturasVencendo: vencendoCartao.length,
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
    todas((de, ate) => supabase.from("transactions").select("household_id, tipo, valor_centavos, pessoa, categoria_id, data_compra, card_id, account_id, invoice_id, total_parcelas, recorrente_id, conta_pagar_id, conta_pagar_ref, descricao").order("id").range(de, ate)),
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
