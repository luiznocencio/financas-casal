import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { saldoConta, limiteDisponivel } from "@/lib/financeiro/derivados";
import { resumoDoMes } from "@/lib/financeiro/agregacoes";
import { ultimoDiaDoMes } from "@/lib/financeiro/fechamento";
import { contaOcorreNoMes, contaVisivelNoMes } from "@/lib/financeiro/contas";
import { centavosParaReais } from "@/lib/financeiro/dinheiro";
import { Money } from "@/components/ui/Money";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { SplitBar } from "@/components/ui/SplitBar";
import { CategoriaTag } from "@/components/ui/CategoriaTag";
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

  const [contasRes, cardsRes, txsRes, catsRes, membrosRes, invoicesRes, contasPagarRes] = await Promise.all([
    supabase.from("accounts").select("*"),
    supabase.from("cards").select("*"),
    supabase.from("transactions").select("*"),
    supabase.from("categories").select("id, nome, cor"),
    supabase.from("members").select("nome, renda_mensal_centavos, ajuda_custo_centavos"),
    supabase.from("invoices").select("id, competencia_ano, competencia_mes"),
    supabase.from("contas_pagar").select("id, valor_estimado_centavos, dia_vencimento, recorrencia, data_fim, created_at").eq("ativo", true),
  ]);
  // falha de leitura não pode virar "R$ 0" silencioso num app de dinheiro
  const erro = contasRes.error ?? cardsRes.error ?? txsRes.error ?? catsRes.error ?? membrosRes.error ?? invoicesRes.error ?? contasPagarRes.error;
  if (erro) throw new Error(`Falha ao carregar o painel: ${erro.message}`);
  const { data: contas } = contasRes;
  const { data: cards } = cardsRes;
  const { data: txs } = txsRes;
  const { data: cats } = catsRes;
  const { data: membrosData } = membrosRes;
  const membros = (membrosData ?? []).map((m) => m.nome);

  // gasto no cartão conta no mês da FATURA (competência), não da data da compra
  const compPorInvoice = new Map((invoicesRes.data ?? []).map((i) => [i.id, { ano: i.competencia_ano, mes: i.competencia_mes }]));
  const txsRef = (txs ?? []).map((t) =>
    t.card_id && t.invoice_id && compPorInvoice.has(t.invoice_id)
      ? { ...t, competencia: compPorInvoice.get(t.invoice_id) }
      : t);

  const saldoTotal = (contas ?? []).reduce((s, c) => {
    const mov = (txs ?? []).filter((t) => t.account_id === c.id);
    return s + saldoConta(c.saldo_inicial_centavos, mov);
  }, 0);

  const comprometido = (cards ?? []).reduce((s, card) => {
    const emAberto = (txs ?? []).filter((t) => t.card_id === card.id && !t.paga);
    return s + (card.limite_centavos - limiteDisponivel(card.limite_centavos, emAberto));
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
  const ehPassado = idxRef < idxAtual;
  const aPagarAtual = faturasAbertasAteAtual + contasPendentesAtual;
  // saldo mostrado na tile: mês atual = saldo vivo; outros meses = projeção/histórico
  const saldoTileValor = ehAtual ? saldoTotal : saldoRef;

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

  // "Despesas do mês" inclui as contas a pagar PENDENTES do mês (despesa que vai
  // existir mesmo antes de vencer). As já pagas já entram como despesa real.
  const pagoContaRef = new Set((txs ?? [])
    .filter((t) => { if (!t.conta_pagar_id) return false; const [a, m] = t.data_compra.split("-").map(Number); return a === ref.ano && m === ref.mes; })
    .map((t) => t.conta_pagar_id));
  const contasPendentesRef = contasAtivas
    .filter((c) => contaVisivelNoMes(c, ref.ano, ref.mes, pagaContaAlgumaVez.has(c.id), pagoContaRef.has(c.id)) && !pagoContaRef.has(c.id))
    .reduce((s, c) => s + (c.valor_estimado_centavos ?? 0), 0);
  const despesasDoMes = resumo.totalDespesas + contasPendentesRef;

  const stats = [
    { rotulo: ehAtual ? "Saldo em contas" : ehFuturo ? "Saldo projetado" : "Saldo no fim do mês", valor: saldoTileValor, sinal: true },
    { rotulo: "Faturas abertas", valor: comprometido, sinal: false },
    { rotulo: "Despesas do mês", valor: despesasDoMes, sinal: false },
    { rotulo: "Receitas do mês", valor: resumo.totalReceitas, sinal: false },
  ];

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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <StatTile key={s.rotulo} rotulo={s.rotulo} valorCentavos={s.valor} sinal={s.sinal} />
        ))}
      </div>

      {/* projeção de caixa: quanto sobra/falta considerando as faturas e contas de cada mês */}
      <div className="rounded-[var(--radius)] border px-4 py-3"
        style={{ borderColor: saldoRef >= 0 ? "var(--positivo)" : "var(--negativo)", background: `color-mix(in srgb, ${saldoRef >= 0 ? "var(--positivo)" : "var(--negativo)"} 8%, transparent)` }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-medium text-[var(--text)]">
              {ehAtual
                ? (saldoRef >= 0 ? "Dá pra pagar o pendente" : "Falta pra pagar o pendente")
                : ehFuturo
                  ? (saldoRef >= 0 ? `Deve sobrar até ${MESES[ref.mes - 1]}` : `Vai faltar até ${MESES[ref.mes - 1]}`)
                  : `Saldo no fim de ${MESES[ref.mes - 1]}`}
            </span>
            <span className="text-xs text-[var(--muted)]">
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
            </span>
          </div>
          <span className="mono text-lg font-semibold" style={{ color: saldoRef >= 0 ? "var(--positivo)" : "var(--negativo)" }}>
            {ehPassado ? centavosParaReais(saldoRef) : <>{saldoRef >= 0 ? "sobra " : "falta "}{centavosParaReais(Math.abs(saldoRef))}</>}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <h3 className="mb-1 font-medium text-[var(--text)]">Fatura de cada um</h3>
          <p className="mb-4 text-xs text-[var(--muted)]">Soma das compras dos cartões de cada pessoa neste mês.</p>
          <SplitBar itens={porPessoa.map(([nome, centavos]) => ({ nome, centavos }))} membros={membros} />
        </Card>

        <Card>
          <h3 className="mb-4 font-medium text-[var(--text)]">Categorias do mês</h3>
          {topCategorias.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Nenhuma categoria com gasto neste mês ainda.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {topCategorias.map(([id, valor]) => (
                <Link key={id} href={`/lancamentos?categoria=${id}`}
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
    </main>
  );
}
