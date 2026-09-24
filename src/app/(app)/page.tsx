import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { saldoConta } from "@/lib/financeiro/derivados";
import { resumoDoMes } from "@/lib/financeiro/agregacoes";
import { ultimoDiaDoMes } from "@/lib/financeiro/fechamento";
import { contaOcorreNoMes, contaVisivelNoMes } from "@/lib/financeiro/contas";
import { centavosParaReais } from "@/lib/financeiro/dinheiro";
import { Money } from "@/components/ui/Money";
import { Card } from "@/components/ui/Card";
import { SplitBar } from "@/components/ui/SplitBar";
import { CategoriaTag } from "@/components/ui/CategoriaTag";
import { SairButton } from "@/components/shell/SairButton";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react/dist/ssr";

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

  const [contasRes, cardsRes, txsRes, catsRes, membrosRes, invoicesRes, contasPagarRes, agendadasRes] = await Promise.all([
    supabase.from("accounts").select("*"),
    supabase.from("cards").select("*"),
    supabase.from("transactions").select("*"),
    supabase.from("categories").select("id, nome, cor"),
    supabase.from("members").select("nome, renda_mensal_centavos, ajuda_custo_centavos"),
    supabase.from("invoices").select("id, competencia_ano, competencia_mes"),
    supabase.from("contas_pagar").select("id, valor_estimado_centavos, dia_vencimento, recorrencia, data_fim, created_at").eq("ativo", true),
    // recebimentos agendados (A receber), INCLUINDO salário — base do "Recebo".
    // Reflete o valor REAL quando já recebido (abono/desconto do salário variável)
    // e o planejado quando pendente; bate com a tela de Planejamento.
    supabase.from("receitas_agendadas").select("id, valor_centavos, data_fim, data_prevista, recorrencia")
      .eq("ativo", true),
  ]);
  // falha de leitura não pode virar "R$ 0" silencioso num app de dinheiro
  const erro = contasRes.error ?? cardsRes.error ?? txsRes.error ?? catsRes.error ?? membrosRes.error ?? invoicesRes.error ?? contasPagarRes.error ?? agendadasRes.error;
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

  // o que ENTRA por mês: salário (renda_mensal + ajuda) + recebimentos fixos
  // mensais (aluguel, renda extra) que ainda não encerraram (data_fim).
  // "Recebo" e "a receber" saem das mesmas "A receber" da tela de Planejamento
  // (agendadas, incluindo salário). Reflete o valor REAL quando já recebido no mês
  // (abono/desconto do salário variável) e o planejado quando ainda pendente.
  const agendadas = agendadasRes.data ?? [];
  const rangeMes = (ano: number, mes: number) => [`${ano}-${pad(mes)}-01`, `${ano}-${pad(mes)}-${pad(ultimoDiaDoMes(ano, mes))}`] as const;
  const ocorreNoMes = (r: { recorrencia: string; data_prevista: string; data_fim: string | null }, ini: string, fim: string) =>
    r.recorrencia === "unica" ? (r.data_prevista >= ini && r.data_prevista <= fim) : (!r.data_fim || r.data_fim >= ini);
  // { receita_agendada_id -> valor real recebido } num mês
  const recebidosNoMes = (ini: string, fim: string) => {
    const m = new Map<string, number>();
    for (const t of txs ?? []) {
      if (!t.receita_agendada_id || t.data_compra < ini || t.data_compra > fim) continue;
      m.set(t.receita_agendada_id, (m.get(t.receita_agendada_id) ?? 0) + t.valor_centavos);
    }
    return m;
  };
  // total do mês: real quando recebido, planejado quando pendente
  const receboDoMes = (ano: number, mes: number) => {
    const [ini, fim] = rangeMes(ano, mes);
    const rec = recebidosNoMes(ini, fim);
    return agendadas.filter((r) => ocorreNoMes(r, ini, fim))
      .reduce((s, r) => s + (rec.has(r.id) ? rec.get(r.id)! : (r.valor_centavos ?? 0)), 0);
  };
  // o que ainda falta receber no mês (só os pendentes, valor planejado)
  const aReceberDoMes = (ano: number, mes: number) => {
    const [ini, fim] = rangeMes(ano, mes);
    const rec = recebidosNoMes(ini, fim);
    return agendadas.filter((r) => ocorreNoMes(r, ini, fim) && !rec.has(r.id))
      .reduce((s, r) => s + (r.valor_centavos ?? 0), 0);
  };
  const recebeNoMes = receboDoMes(ref.ano, ref.mes);
  const aReceberAtual = aReceberDoMes(atual.ano, atual.mes);

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
      const entrada = ehAtualLoop ? aReceberAtual : receboDoMes(y, mo);
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
    if (!t.card_id || t.tipo !== "despesa") continue;
    const comp = t.competencia;
    const ano = comp ? comp.ano : Number(t.data_compra.slice(0, 4));
    const mes = comp ? comp.mes : Number(t.data_compra.slice(5, 7));
    if (ano !== ref.ano || mes !== ref.mes) continue;
    const pessoa = titularPorCard.get(t.card_id) ?? "conjunto";
    faturaPorPessoa[pessoa] = (faturaPorPessoa[pessoa] ?? 0) + t.valor_centavos;
  }
  const porPessoa = Object.entries(faturaPorPessoa).sort((a, b) => b[1] - a[1]);
  const totalCartoesMes = porPessoa.reduce((s, [, v]) => s + v, 0);
  const totalPixContaMes = Math.max(0, resumo.totalDespesas - totalCartoesMes);
  const topCategorias = Object.entries(resumo.porCategoria).sort((a, b) => b[1] - a[1]);
  const maiorCategoria = topCategorias.length ? topCategorias[0][1] : 0;

  // Margem do mês: o que ENTRA − o que GASTO. Gasto = consumo do mês (cartão +
  // pix/conta) + contas a pagar pendentes. Dá a clareza de "quanto posso gastar".
  const pagoContaRef = new Set((txs ?? [])
    .filter((t) => { if (!t.conta_pagar_id) return false; const [a, m] = t.data_compra.split("-").map(Number); return a === ref.ano && m === ref.mes; })
    .map((t) => t.conta_pagar_id));
  const contasPendentesRef = contasAtivas
    .filter((c) => contaVisivelNoMes(c, ref.ano, ref.mes, pagaContaAlgumaVez.has(c.id), pagoContaRef.has(c.id)) && !pagoContaRef.has(c.id))
    .reduce((s, c) => s + (c.valor_estimado_centavos ?? 0), 0);
  const gastoMes = resumo.totalDespesas + contasPendentesRef;
  const margem = recebeNoMes - gastoMes;
  const corMargem = margem >= 0 ? "var(--positivo)" : "var(--negativo)";

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
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          {saldoRef >= 0
            ? <CheckCircle size={30} weight="fill" style={{ color: "var(--positivo)" }} aria-label="Dá pra pagar tudo" />
            : <WarningCircle size={30} weight="fill" style={{ color: "var(--negativo)" }} aria-label="Não fecha as contas" />}
          <span className="mono text-3xl font-bold" style={{ color: corCaixa }}>{dinheiro(saldoRef)}</span>
          <span className="text-lg font-semibold" style={{ color: corCaixa }}>{tituloCaixa}</span>
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          {ehAtual ? (
            <>
              Saldo <Money centavos={saldoTotal} tamanho="sm" />
              {aReceberAtual > 0 && <> + a receber <Money centavos={aReceberAtual} tamanho="sm" /></>}
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
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-medium text-[var(--text)]">Cartão de cada um</h3>
            <span className="text-sm text-[var(--text)]">Total <strong><Money centavos={totalCartoesMes} tamanho="sm" /></strong></span>
          </div>
          <p className="mb-4 text-xs text-[var(--muted)]">Compras nos cartões de cada pessoa neste mês (pela data; parcela conta a parcela do mês).</p>
          <SplitBar itens={porPessoa.map(([nome, centavos]) => ({ nome, centavos }))} membros={membros} />
        </Card>

        <Card>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-medium text-[var(--text)]">Categorias do mês</h3>
            <span className="text-sm text-[var(--text)]">Total <strong><Money centavos={resumo.totalDespesas} tamanho="sm" /></strong></span>
          </div>
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

      {/* ───── MARGEM — quanto entra × quanto gasto (dinheiro real) ───── */}
      <Card>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Margem do mês</span>
          <Link href="/orcamento" className="shrink-0 text-sm text-[var(--accent)]">Orçamento</Link>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="mono text-2xl font-bold" style={{ color: corMargem }}>{dinheiro(margem)}</span>
          <span className="text-sm text-[var(--muted)]">{margem >= 0 ? "de margem pra gastar" : "acima do que entra"}</span>
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Recebo <Money centavos={recebeNoMes} tamanho="sm" /> − gasto <Money centavos={gastoMes} tamanho="sm" />
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--border)] pt-3">
          <div><div className="text-xs text-[var(--muted)]">Cartões</div><Money centavos={totalCartoesMes} tamanho="sm" /></div>
          <div><div className="text-xs text-[var(--muted)]">Pix/conta</div><Money centavos={totalPixContaMes} tamanho="sm" /></div>
          <div><div className="text-xs text-[var(--muted)]">Contas a pagar</div><Money centavos={contasPendentesRef} tamanho="sm" /></div>
        </div>
      </Card>
    </main>
  );
}
