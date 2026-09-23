import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { saldoConta } from "@/lib/financeiro/derivados";
import { resumoDoMes } from "@/lib/financeiro/agregacoes";
import { resumoOrcamento } from "@/lib/financeiro/orcamento";
import { ultimoDiaDoMes } from "@/lib/financeiro/fechamento";
import { contaOcorreNoMes, contaVisivelNoMes } from "@/lib/financeiro/contas";
import { centavosParaReais } from "@/lib/financeiro/dinheiro";
import { Money } from "@/components/ui/Money";
import { Card } from "@/components/ui/Card";
import { SplitBar } from "@/components/ui/SplitBar";
import { CategoriaTag } from "@/components/ui/CategoriaTag";
import { BarraOrcamento } from "@/components/orcamento/BarraOrcamento";
import { SairButton } from "@/components/shell/SairButton";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const supabase = await createServerSupabase();
  const sp = await searchParams;
  const agora = new Date();
  const atual = { ano: agora.getFullYear(), mes: agora.getMonth() + 1 };
  let ref = atual;
  if (sp.mes && /^\d{4}-\d{2}$/.test(sp.mes)) {
    const [a, m] = sp.mes.split("-").map(Number);
    if (m >= 1 && m <= 12) ref = { ano: a, mes: m };
  }
  const ehAtual = ref.ano === atual.ano && ref.mes === atual.mes;
  const mesPrev = ref.mes === 1 ? { ano: ref.ano - 1, mes: 12 } : { ano: ref.ano, mes: ref.mes - 1 };
  const mesProx = ref.mes === 12 ? { ano: ref.ano + 1, mes: 1 } : { ano: ref.ano, mes: ref.mes + 1 };
  const paramMes = (c: { ano: number; mes: number }) => `/?mes=${c.ano}-${String(c.mes).padStart(2, "0")}`;

  const [contasRes, cardsRes, txsRes, catsRes, membrosRes, invoicesRes, contasPagarRes, budgetsRes] = await Promise.all([
    supabase.from("accounts").select("*"),
    supabase.from("cards").select("*"),
    supabase.from("transactions").select("*"),
    supabase.from("categories").select("id, nome, cor, parent_id").eq("tipo", "despesa"),
    supabase.from("members").select("nome, renda_mensal_centavos, ajuda_custo_centavos"),
    supabase.from("invoices").select("id, competencia_ano, competencia_mes"),
    supabase.from("contas_pagar").select("id, valor_estimado_centavos, dia_vencimento, recorrencia, data_fim, created_at").eq("ativo", true),
    supabase.from("budgets").select("categoria_id, valor_centavos"),
  ]);
  // falha de leitura não pode virar "R$ 0" silencioso num app de dinheiro
  const erro = contasRes.error ?? cardsRes.error ?? txsRes.error ?? catsRes.error ?? membrosRes.error ?? invoicesRes.error ?? contasPagarRes.error ?? budgetsRes.error;
  if (erro) throw new Error(`Falha ao carregar o painel: ${erro.message}`);
  const { data: contas } = contasRes;
  const { data: cards } = cardsRes;
  const { data: txs } = txsRes;
  const { data: cats } = catsRes;
  const { data: membrosData } = membrosRes;
  const membros = (membrosData ?? []).map((m) => m.nome);

  // CONSUMO = mês da compra: à vista (pix e cartão) conta pela data; parcela conta
  // a parcela no mês em que ela entra na fatura (competência), pra não somar as 10
  // parcelas num mês só. A camada de caixa (projeção) usa outra régua, mais abaixo.
  const compPorInvoice = new Map((invoicesRes.data ?? []).map((i) => [i.id, { ano: i.competencia_ano, mes: i.competencia_mes }]));
  const txsRef = (txs ?? []).map((t) =>
    t.card_id && t.total_parcelas > 1 && t.invoice_id && compPorInvoice.has(t.invoice_id)
      ? { ...t, competencia: compPorInvoice.get(t.invoice_id) }
      : t);

  const saldoTotal = (contas ?? []).reduce((s, c) => {
    const mov = (txs ?? []).filter((t) => t.account_id === c.id);
    return s + saldoConta(c.saldo_inicial_centavos, mov);
  }, 0);

  const resumo = resumoDoMes(txsRef, ref);
  const pad = (n: number) => String(n).padStart(2, "0");
  const chaveMes = (a: number, m: number) => `${a}-${m}`;
  const idxMes = (a: number, m: number) => a * 12 + m;
  const idxAtual = idxMes(atual.ano, atual.mes);
  const idxRef = idxMes(ref.ano, ref.mes);

  // renda mensal (salário fixo do orçamento) e o que ainda falta cair NO MÊS ATUAL
  const rendaMensal = (membrosData ?? []).reduce((s, m) => s + (m.renda_mensal_centavos ?? 0) + (m.ajuda_custo_centavos ?? 0), 0);
  const resumoAtual = idxRef === idxAtual ? resumo : resumoDoMes(txsRef, atual);
  const aReceberAtual = Math.max(0, rendaMensal - resumoAtual.totalReceitas);

  // faturas em aberto por competência (mês da fatura), pra saber o que sai em cada mês
  const faturaAbertaPorComp: Record<string, number> = {};
  for (const t of txs ?? []) {
    if (!t.card_id || t.paga) continue;
    const comp = t.invoice_id ? compPorInvoice.get(t.invoice_id) : null;
    if (!comp) continue;
    faturaAbertaPorComp[chaveMes(comp.ano, comp.mes)] = (faturaAbertaPorComp[chaveMes(comp.ano, comp.mes)] ?? 0) + t.valor_centavos;
  }
  // tudo que está em aberto até o mês atual (inclui atrasos), some no mês corrente
  const faturasAbertasAteAtual = Object.entries(faturaAbertaPorComp)
    .filter(([k]) => { const [a, m] = k.split("-").map(Number); return idxMes(a, m) <= idxAtual; })
    .reduce((s, [, v]) => s + v, 0);

  // contas a pagar: respeita recorrência (mensal/única) e data_fim
  const contasAtivas = contasPagarRes.data ?? [];
  const pagoContaMesAtual = new Set((txs ?? [])
    .filter((t) => { if (!t.conta_pagar_id) return false; const [a, m] = t.data_compra.split("-").map(Number); return a === atual.ano && m === atual.mes; })
    .map((t) => t.conta_pagar_id));
  const pagaContaAlgumaVez = new Set((txs ?? []).filter((t) => t.conta_pagar_id).map((t) => t.conta_pagar_id));
  // pendente do mês atual = conta visível neste mês e ainda não paga neste mês
  const contasPendentesAtual = contasAtivas
    .filter((c) => contaVisivelNoMes(c, atual.ano, atual.mes, pagaContaAlgumaVez.has(c.id), pagoContaMesAtual.has(c.id)) && !pagoContaMesAtual.has(c.id))
    .reduce((s, c) => s + (c.valor_estimado_centavos ?? 0), 0);
  // contas devidas num mês futuro (única só no mês dela e se ainda não paga)
  const contasDoMes = (a: number, m: number) => contasAtivas
    .filter((c) => contaOcorreNoMes(c, a, m) && !(c.recorrencia === "unica" && pagaContaAlgumaVez.has(c.id)))
    .reduce((s, c) => s + (c.valor_estimado_centavos ?? 0), 0);

  // Projeção de caixa: parte do saldo de hoje e rola mês a mês até o mês visto,
  // somando a renda e descontando faturas/contas de cada mês. Pro passado, mostra
  // o saldo real no fim do mês (só o que está lançado até lá).
  let saldoRef: number;
  if (idxRef < idxAtual) {
    const fimRef = `${ref.ano}-${pad(ref.mes)}-${pad(ultimoDiaDoMes(ref.ano, ref.mes))}`;
    saldoRef = (contas ?? []).reduce((s, c) => {
      const mov = (txs ?? []).filter((t) => t.account_id === c.id && t.data_compra <= fimRef);
      return s + saldoConta(c.saldo_inicial_centavos, mov);
    }, 0);
  } else {
    let running = saldoTotal;
    for (let i = idxAtual; i <= idxRef; i++) {
      const y = Math.floor((i - 1) / 12);
      const mo = i - y * 12;
      const ehAtualLoop = i === idxAtual;
      const entrada = ehAtualLoop ? aReceberAtual : rendaMensal;
      const saidaFaturas = ehAtualLoop ? faturasAbertasAteAtual : (faturaAbertaPorComp[chaveMes(y, mo)] ?? 0);
      const saidaContas = ehAtualLoop ? contasPendentesAtual : contasDoMes(y, mo);
      running += entrada - saidaFaturas - saidaContas;
    }
    saldoRef = running;
  }

  const ehFuturo = idxRef > idxAtual;
  const aPagarAtual = faturasAbertasAteAtual + contasPendentesAtual;

  const catById = new Map((cats ?? []).map((c) => [c.id, c]));
  const nomeCat = (id: string) => catById.get(id)?.nome ?? "Outros";
  const corCat = (id: string) => catById.get(id)?.cor ?? "#6b7280";

  // fatura de cada um no mês: soma das compras dos cartões, por titular do cartão
  // (na competência da fatura — mesma regra do resto do painel)
  const titularPorCard = new Map((cards ?? []).map((c) => [c.id, c.titular]));
  const faturaPorPessoa: Record<string, number> = {};
  for (const t of txsRef) {
    if (!t.card_id) continue;
    const comp = t.competencia;
    const ano = comp ? comp.ano : Number(t.data_compra.slice(0, 4));
    const mes = comp ? comp.mes : Number(t.data_compra.slice(5, 7));
    if (ano !== ref.ano || mes !== ref.mes) continue;
    const pessoa = titularPorCard.get(t.card_id) ?? "conjunto";
    faturaPorPessoa[pessoa] = (faturaPorPessoa[pessoa] ?? 0) + t.valor_centavos;
  }
  const porPessoa = Object.entries(faturaPorPessoa).sort((a, b) => b[1] - a[1]);
  const topCategorias = Object.entries(resumo.porCategoria).sort((a, b) => b[1] - a[1]);
  const maiorCategoria = topCategorias.length ? topCategorias[0][1] : 0;

  // resumo do orçamento do mês (consumo): orçado x gasto, placar e alertas.
  // o gasto do filho soma na mãe (o limite mora na mãe).
  const paiDe = new Map((cats ?? []).filter((c) => c.parent_id).map((c) => [c.id, c.parent_id as string]));
  const gastoRollup: Record<string, number> = {};
  for (const [catId, val] of Object.entries(resumo.porCategoria)) {
    const alvo = paiDe.get(catId) ?? catId;
    gastoRollup[alvo] = (gastoRollup[alvo] ?? 0) + val;
  }
  const budgets = budgetsRes.data ?? [];
  const resumoOrc = resumoOrcamento({ rendaCentavos: rendaMensal, budgets, gastoPorCategoria: gastoRollup });
  const totalOrcado = resumoOrc.totalOrcadoCentavos;
  const orcItens = resumoOrc.itens.filter((i) => i.limiteCentavos > 0);
  const placar = {
    azul: orcItens.filter((i) => i.pctUsado <= 85).length,
    perto: orcItens.filter((i) => i.pctUsado > 85 && i.pctUsado <= 100).length,
    estourou: orcItens.filter((i) => i.pctUsado > 100).length,
  };

  // Caixa é a resposta principal: "dá pra pagar tudo?" — folga real = saldo +
  // rendas a entrar − faturas/contas a pagar. (Plano/orçamento é só planejamento.)
  const dinheiro = (c: number) => c < 0 ? `−${centavosParaReais(Math.abs(c))}` : centavosParaReais(c);
  const corCaixa = saldoRef >= 0 ? "var(--positivo)" : "var(--negativo)";
  const tituloCaixa = ehAtual
    ? (saldoRef >= 0 ? "Dá pra pagar tudo" : "Não fecha as contas")
    : ehFuturo
      ? (saldoRef >= 0 ? `Deve fechar até ${MESES[ref.mes - 1]}` : `Pode faltar até ${MESES[ref.mes - 1]}`)
      : `Fim de ${MESES[ref.mes - 1]}`;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <Link href={paramMes(mesPrev)} aria-label="Mês anterior"
              className="rounded-md px-2 py-1 text-xl leading-none text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]">‹</Link>
            <h1 className="text-2xl font-bold capitalize text-[var(--text)]">
              {MESES[ref.mes - 1]}{ref.ano !== atual.ano ? ` ${ref.ano}` : ""}
            </h1>
            <Link href={paramMes(mesProx)} aria-label="Próximo mês"
              className="rounded-md px-2 py-1 text-xl leading-none text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]">›</Link>
            {!ehAtual && <Link href="/" className="ml-1 text-xs text-[var(--accent)]">hoje</Link>}
          </div>
          <p className="text-sm text-[var(--muted)]">Visão do casal</p>
        </div>
        <div className="lg:hidden"><SairButton variant="inline" /></div>
      </header>

      {/* ───── CAIXA — a resposta principal: dá pra pagar tudo? ───── */}
      <Card>
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Caixa</span>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
          <span className="mono text-3xl font-bold" style={{ color: corCaixa }}>{dinheiro(saldoRef)}</span>
          <span className="text-lg font-semibold" style={{ color: corCaixa }}>{tituloCaixa}</span>
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          {ehAtual ? (
            <>
              Saldo <Money centavos={saldoTotal} tamanho="sm" />
              {aReceberAtual > 0 && <> + renda a entrar <Money centavos={aReceberAtual} tamanho="sm" /></>}
              {" − "}a pagar <Money centavos={aPagarAtual} tamanho="sm" /> (faturas + contas)
            </>
          ) : ehFuturo ? (
            <>Projeção partindo do saldo de hoje, somando a renda e descontando as faturas/contas de cada mês.</>
          ) : (
            <>Saldo real no fim do mês, pelo que está lançado.</>
          )}
        </p>
        <p className="mt-2 border-t border-[var(--border)] pt-2 text-xs text-[var(--muted)]">
          Recebido no mês <Money centavos={resumo.totalReceitas} tamanho="sm" />
        </p>
      </Card>

      {/* ───── PANORAMA: pra onde o dinheiro foi neste mês ───── */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <h3 className="mb-1 font-medium text-[var(--text)]">Cartão de cada um</h3>
          <p className="mb-4 text-xs text-[var(--muted)]">Compras nos cartões de cada pessoa neste mês (pela data; parcela conta a parcela do mês).</p>
          <SplitBar itens={porPessoa.map(([nome, centavos]) => ({ nome, centavos }))} membros={membros} />
        </Card>

        <Card>
          <h3 className="mb-4 font-medium text-[var(--text)]">Categorias do mês</h3>
          {topCategorias.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Nenhuma categoria com gasto neste mês ainda.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {topCategorias.map(([id, valor]) => (
                <Link key={id} href={`/lancamentos?categoria=${id}&mes=${ref.ano}-${pad(ref.mes)}`}
                  className="-mx-2 flex flex-col gap-1.5 rounded-[var(--radius-sm)] px-2 py-1 transition-colors hover:bg-[var(--surface-2)]">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <CategoriaTag nome={nomeCat(id)} cor={corCat(id)} />
                    <Money centavos={valor} />
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${maiorCategoria > 0 ? (valor / maiorCategoria) * 100 : 0}%`, background: corCat(id) }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ───── PLANO — só planejamento (calmo, por último) ───── */}
      <Card>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Plano · controle de gastos</span>
          <Link href="/orcamento" className="shrink-0 text-sm text-[var(--accent)]">Ver</Link>
        </div>
        {totalOrcado > 0 ? (
          <>
            <BarraOrcamento gastoCentavos={resumo.totalDespesas} limiteCentavos={totalOrcado} cor="var(--accent)" />
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
              <span><strong style={{ color: "var(--positivo)" }}>{placar.azul}</strong> no azul</span>
              <span><strong style={{ color: "var(--alerta)" }}>{placar.perto}</strong> perto</span>
              <span><strong style={{ color: "var(--negativo)" }}>{placar.estourou}</strong> estourou</span>
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">É só o planejado — passar do orçamento não quer dizer que falta dinheiro (isso é o <strong>Caixa</strong>, lá em cima).</p>
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">Defina limites por categoria na aba <Link href="/orcamento" className="text-[var(--accent)]">Orçamento</Link> pra acompanhar aqui.</p>
        )}
      </Card>
    </main>
  );
}
