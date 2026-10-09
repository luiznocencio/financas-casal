import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { saldoConta } from "@/lib/financeiro/derivados";
import { resumoDoMes } from "@/lib/financeiro/agregacoes";
import { ultimoDiaDoMes, partesNoFuso } from "@/lib/financeiro/fechamento";
import { contaOcorreNoMes, mesesEmAberto, quitadosPorConta, chaveMes as chaveMesConta } from "@/lib/financeiro/contas";
import { centavosParaReais } from "@/lib/financeiro/dinheiro";
import { Money } from "@/components/ui/Money";
import { Card } from "@/components/ui/Card";
import { SplitBar } from "@/components/ui/SplitBar";
import { CategoriaTag } from "@/components/ui/CategoriaTag";
import { SairButton } from "@/components/shell/SairButton";
import { CheckCircle, WarningCircle, Wallet, Receipt } from "@phosphor-icons/react/dist/ssr";
import { orcamentoDoMes } from "@/lib/financeiro/projecao";
import { valorNaFatura, faturaAtualDoCartao, faturasEmAbertoAteAtual } from "@/lib/financeiro/faturas";
import type { FatosResumo } from "@/lib/financeiro/resumoFrase";
import { ResumoFrase } from "@/components/dashboard/ResumoFrase";
import { todas } from "@/lib/supabase/todas";

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

  const [contasRes, cardsRes, txsRes, catsRes, membrosRes, invoicesRes, contasPagarRes, agendadasRes, budgetsRes, fixosRes] = await Promise.all([
    supabase.from("accounts").select("*"),
    supabase.from("cards").select("*"),
    todas((de, ate) => supabase.from("transactions").select("*").order("id").range(de, ate)),
    supabase.from("categories").select("id, nome, cor, parent_id"),
    supabase.from("members").select("nome, renda_mensal_centavos, ajuda_custo_centavos"),
    supabase.from("invoices").select("id, card_id, competencia_ano, competencia_mes, status"),
    supabase.from("contas_pagar").select("id, descricao, categoria_id, valor_estimado_centavos, dia_vencimento, recorrencia, data_fim, created_at").eq("ativo", true),
    // recebimentos agendados (A receber), INCLUINDO salário — base do "Recebo".
    // Reflete o valor REAL quando já recebido (abono/desconto do salário variável)
    // e o planejado quando pendente; bate com a tela de Planejamento.
    supabase.from("receitas_agendadas").select("id, valor_centavos, data_fim, data_prevista, recorrencia")
      .eq("ativo", true),
    // orçamento projetado (pro resumo do mês): limites + gastos fixos
    supabase.from("budgets").select("categoria_id, valor_centavos"),
    supabase.from("recorrentes").select("id, descricao, valor_centavos, categoria_id, dia, card_id, account_id, data_fim, ativo").eq("ativo", true),
  ]);
  // falha de leitura não pode virar "R$ 0" silencioso num app de dinheiro
  const erro = contasRes.error ?? cardsRes.error ?? txsRes.error ?? catsRes.error ?? membrosRes.error ?? invoicesRes.error ?? contasPagarRes.error ?? agendadasRes.error ?? budgetsRes.error ?? fixosRes.error;
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
    faturaAbertaPorComp[chaveMes(comp.ano, comp.mes)] = (faturaAbertaPorComp[chaveMes(comp.ano, comp.mes)] ?? 0) + valorNaFatura(t);
  }
  // tudo que está em aberto até o mês atual (inclui atrasos), some no mês corrente
  const faturasAbertasAteAtual = Object.entries(faturaAbertaPorComp)
    .filter(([k]) => { const [a, m] = k.split("-").map(Number); return idxMes(a, m) <= idxAtual; })
    .reduce((s, [, v]) => s + v, 0);

  // contas a pagar: respeita recorrência (mensal/única) e data_fim
  const contasAtivas = contasPagarRes.data ?? [];
  // meses já quitados de cada conta (pelo mês que o pagamento quita, não pela data)
  const quitados = quitadosPorConta(txs ?? []);
  const quitadosDe = (id: string) => quitados.get(id) ?? new Set<string>();
  // pendente agora = TODOS os meses em aberto até o atual: conta não paga não
  // some na virada do mês, continua devida (atrasada) até ser quitada
  const contasPendentesAtual = contasAtivas
    .reduce((s, c) => s + mesesEmAberto(c, quitadosDe(c.id), atual).length * (c.valor_estimado_centavos ?? 0), 0);
  // a cobrança de um mês específico, se ainda não quitada
  const contasDoMes = (a: number, m: number) => contasAtivas
    .filter((c) => contaOcorreNoMes(c, a, m) && !quitadosDe(c.id).has(chaveMesConta({ ano: a, mes: m })))
    .reduce((s, c) => s + (c.valor_estimado_centavos ?? 0), 0);

  // Projeção de caixa: parte do saldo de hoje e rola mês a mês até o mês visto,
  // somando a renda e descontando faturas/contas de cada mês. Pro passado, mostra
  // o saldo real no fim do mês (só o que está lançado até lá).
  let saldoRef: number;
  // acumulados da projeção até o mês visto (alimentam os blocos "Vou ter" / "Já tem destino")
  let entradasAte = 0;
  let saidasAte = 0;
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
      entradasAte += entrada;
      saidasAte += saidaFaturas + saidaContas;
    }
    saldoRef = running;
  }

  const ehFuturo = idxRef > idxAtual;
  const aPagarAtual = faturasAbertasAteAtual + contasPendentesAtual;

  const catById = new Map((cats ?? []).map((c) => [c.id, c]));
  const nomeCat = (id: string) => catById.get(id)?.nome ?? "Outros";
  const corCat = (id: string) => catById.get(id)?.cor ?? "#6b7280";

  // compras no cartão feitas NESTE mês (consumo: à vista pela data; parcela pela
  // fatura) — só pra separar cartão de pix/conta no "gasto do mês"
  const totalCartoesMes = txsRef.reduce((s, t) => {
    if (!t.card_id || t.tipo !== "despesa") return s;
    const comp = t.competencia;
    const ano = comp ? comp.ano : Number(t.data_compra.slice(0, 4));
    const mes = comp ? comp.mes : Number(t.data_compra.slice(5, 7));
    return ano === ref.ano && mes === ref.mes ? s + t.valor_centavos : s;
  }, 0);
  const totalPixContaMes = Math.max(0, resumo.totalDespesas - totalCartoesMes);

  // FATURA EM ABERTO de cada um: a fatura atual de cada cartão (onde estão caindo
  // as compras de agora — ex.: em outubro, a de novembro) + alguma anterior ainda
  // não paga. O mesmo número da tela Cartões. Estorno/crédito abate.
  // Mês atual: hoje. Outro mês: o último dia dele (passado: a fatura que estava
  // aberta no fim do mês, mesmo que já paga depois).
  const hojeFuso = partesNoFuso(new Date(), "America/Sao_Paulo");
  const diaRef = ehAtual ? hojeFuso : { ano: ref.ano, mes: ref.mes, dia: ultimoDiaDoMes(ref.ano, ref.mes) };
  const faturasContadas = new Set<string>();
  for (const card of cards ?? []) {
    const atualCard = faturaAtualDoCartao(card, diaRef);
    const doCartao = (invoicesRes.data ?? []).filter((i) => i.card_id === card.id);
    const contam = idxRef < idxAtual
      ? doCartao.filter((i) => i.competencia_ano === atualCard.ano && i.competencia_mes === atualCard.mes)
      : faturasEmAbertoAteAtual(doCartao, atualCard);
    for (const i of contam) faturasContadas.add(i.id);
  }
  const titularPorCard = new Map((cards ?? []).map((c) => [c.id, c.titular]));
  const faturaPorPessoa: Record<string, number> = {};
  for (const t of txs ?? []) {
    if (!t.card_id || !t.invoice_id || !faturasContadas.has(t.invoice_id)) continue;
    const pessoa = titularPorCard.get(t.card_id) ?? "conjunto";
    faturaPorPessoa[pessoa] = (faturaPorPessoa[pessoa] ?? 0) + valorNaFatura(t);
  }
  const porPessoa = Object.entries(faturaPorPessoa).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const totalFaturasMes = porPessoa.reduce((s, [, v]) => s + v, 0);
  const topCategorias = Object.entries(resumo.porCategoria).sort((a, b) => b[1] - a[1]);
  const maiorCategoria = topCategorias.length ? topCategorias[0][1] : 0;

  // Margem do mês: o que ENTRA − o que GASTO. Gasto = consumo do mês (cartão +
  // pix/conta) + contas a pagar pendentes. Dá a clareza de "quanto posso gastar".
  // mês atual: tudo em aberto (inclui atrasadas); outro mês: a cobrança dele em aberto
  const contasPendentesRef = ehAtual ? contasPendentesAtual : contasDoMes(ref.ano, ref.mes);
  const gastoMes = resumo.totalDespesas + contasPendentesRef;
  const margem = recebeNoMes - gastoMes;
  const corMargem = margem >= 0 ? "var(--positivo)" : "var(--negativo)";

  // Caixa em cascata (liga caixa e margem): saldo + falta receber − falta pagar =
  // sobra no fim do mês; − cartão já usado que só vence depois = sobra de verdade.
  const ehPassado = idxRef < idxAtual;
  // compras no cartão JÁ feitas (consumo até o mês visto) que vencem DEPOIS dele:
  // ainda não estão no "a pagar", mas já comprometem o próximo salário. Parcela
  // futura é consumo futuro (fica de fora); à vista conta pela data da compra.
  const cartaoVenceDepois = ehPassado ? 0 : (txs ?? []).reduce((s, t) => {
    if (!t.card_id || t.paga || t.tipo !== "despesa" || !t.invoice_id) return s;
    const comp = compPorInvoice.get(t.invoice_id);
    if (!comp || idxMes(comp.ano, comp.mes) <= idxRef) return s;
    const idxConsumo = t.total_parcelas > 1
      ? idxMes(comp.ano, comp.mes)
      : idxMes(Number(t.data_compra.slice(0, 4)), Number(t.data_compra.slice(5, 7)));
    return idxConsumo <= idxRef ? s + t.valor_centavos : s;
  }, 0);
  const sobraReal = saldoRef - cartaoVenceDepois;
  const dinheiro = (c: number) => c < 0 ? `−${centavosParaReais(Math.abs(c))}` : centavosParaReais(c);
  // 3 estados: sobra de verdade (ok) · fecha o mês mas já comprometeu parte do
  // próximo salário com o cartão (comprometido) · não fecha nem o mês (falta)
  const estadoCaixa: "ok" | "comprometido" | "falta" = ehPassado
    ? (saldoRef >= 0 ? "ok" : "falta")
    : saldoRef < 0 ? "falta" : sobraReal < 0 ? "comprometido" : "ok";
  const corCaixa = estadoCaixa === "ok" ? "var(--positivo)" : estadoCaixa === "comprometido" ? "var(--alerta)" : "var(--negativo)";
  const ateMes = ehFuturo ? ` até ${MESES[ref.mes - 1]}` : "";
  // três blocos: Vou ter − Já tem destino = Livre (= sobraReal)
  const vouTer = saldoTotal + entradasAte;              // mês atual: saldo + a receber
  const jaTemDestino = saidasAte + cartaoVenceDepois;   // faturas + contas + cartão que vence depois
  const rotuloLivre = estadoCaixa === "ok" ? "Livre"
    : estadoCaixa === "comprometido" ? "Já usou do próximo salário" : "Falta";
  const subLivre = estadoCaixa === "ok" ? `pode gastar${ateMes}`
    : estadoCaixa === "comprometido" ? "no cartão, antes do salário cair"
      : (ehFuturo ? `pra fechar até ${MESES[ref.mes - 1]}` : "pra fechar o mês");

  // resumo do mês em uma frase: os números saem daqui; a IA só redige
  const orc = orcamentoDoMes(ref, {
    cats: cats ?? [], budgets: budgetsRes.data ?? [], txs: txs ?? [], invoices: invoicesRes.data ?? [],
    // projeção do que ainda vai cair só faz sentido do mês atual em diante
    fixos: ehPassado ? [] : fixosRes.data ?? [], contas: ehPassado ? [] : contasAtivas, hoje: atual,
  });
  const gastoAnterior = resumoDoMes(txsRef, mesPrev).totalDespesas;
  const fatos: FatosResumo = {
    mes: MESES[ref.mes - 1],
    momento: ehPassado ? "passado" : ehFuturo ? "futuro" : "atual",
    recebo: centavosParaReais(recebeNoMes),
    gasto: centavosParaReais(gastoMes),
    resultadoPositivo: margem >= 0,
    resultado: centavosParaReais(Math.abs(margem)),
    estado: estadoCaixa,
    livre: centavosParaReais(Math.abs(ehPassado ? saldoRef : sobraReal)),
    gastoMesAnterior: gastoAnterior > 0 ? centavosParaReais(gastoAnterior) : null,
    gastoSubiu: gastoAnterior > 0 ? resumo.totalDespesas > gastoAnterior : null,
    maiores: topCategorias.slice(0, 2).map(([id, v]) => ({ nome: nomeCat(id), valor: centavosParaReais(v) })),
    estouradas: orc.itens.filter((i) => i.estado === "estourou").sort((a, b) => b.excesso - a.excesso)
      .map((i) => ({ nome: nomeCat(i.categoria_id), excesso: centavosParaReais(i.excesso) })),
    vaoPassar: orc.itens.filter((i) => i.estado === "vai_estourar").sort((a, b) => b.excesso - a.excesso)
      .map((i) => ({ nome: nomeCat(i.categoria_id), excesso: centavosParaReais(i.excesso) })),
  };
  const mesChave = `${ref.ano}-${pad(ref.mes)}`;

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

      <ResumoFrase key={mesChave} mes={mesChave} fatos={fatos} />

      {/* ───── CAIXA DO MÊS — três blocos: Vou ter · Já tem destino · Livre ───── */}
      <Card>
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Caixa do mês</span>

        {ehPassado ? (
          <>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="mono text-3xl font-bold" style={{ color: corCaixa }}>{dinheiro(saldoRef)}</span>
              <span className="text-sm text-[var(--muted)]">no fim de {MESES[ref.mes - 1]}</span>
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">Saldo real no fim do mês, pelo que está lançado.</p>
          </>
        ) : (
          <>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <BlocoCaixa
                icone={<Wallet size={15} aria-hidden />}
                rotulo={ehFuturo ? `Vou ter até ${MESES[ref.mes - 1]}` : "Vou ter"}
                valor={vouTer}
                sub={ehAtual ? "saldo + a receber" : "saldo + o que entra"} />
              <BlocoCaixa
                icone={<Receipt size={15} aria-hidden />}
                rotulo="Já tem destino"
                valor={jaTemDestino}
                sub="contas, faturas e cartão" />
              <BlocoCaixa
                icone={estadoCaixa === "ok" ? <CheckCircle size={15} weight="fill" aria-hidden /> : <WarningCircle size={15} weight="fill" aria-hidden />}
                rotulo={rotuloLivre}
                valor={Math.abs(sobraReal)}
                sub={subLivre}
                cor={corCaixa} />
            </div>

            {/* a conta completa fica recolhida: abre só pra quem quer entender de onde vem */}
            <details className="mt-3">
              <summary className="cursor-pointer select-none text-sm text-[var(--accent)]">Ver detalhes</summary>
              <div className="mt-2 flex flex-col gap-1 text-sm">
                {ehAtual ? (
                  <>
                    <LinhaCascata rotulo="Saldo em conta hoje" valor={saldoTotal} />
                    <LinhaCascata rotulo="Falta receber este mês" valor={aReceberAtual} sinal />
                    <LinhaCascata rotulo="Falta pagar este mês (faturas + contas)" valor={-aPagarAtual} />
                  </>
                ) : (
                  <p className="text-xs text-[var(--muted)]">
                    Projeção a partir do saldo de hoje, somando o que entra e descontando faturas e contas de cada mês até {MESES[ref.mes - 1]}.
                  </p>
                )}
                <LinhaCascata rotulo={ehAtual ? "Sobra no fim do mês" : `Sobra no fim de ${MESES[ref.mes - 1]}`} valor={saldoRef} forte />
                <LinhaCascata rotulo="Cartão já usado que vence depois" valor={-cartaoVenceDepois} />
                <LinhaCascata rotulo="Sobra de verdade" valor={sobraReal} forte cor={corCaixa} />
              </div>
            </details>
          </>
        )}

        {/* totais do mês (consumo): o que entra × o que gasto */}
        <div className="mt-4 border-t border-[var(--border)] pt-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-[var(--muted)]">
            <span>Neste mês: recebo <Money centavos={recebeNoMes} tamanho="sm" /> − gasto <Money centavos={gastoMes} tamanho="sm" /></span>
            <span>resultado <strong className="mono" style={{ color: corMargem }}>{dinheiro(margem)}</strong></span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div><div className="text-xs text-[var(--muted)]">Compras no cartão</div><Money centavos={totalCartoesMes} tamanho="sm" /></div>
            <div><div className="text-xs text-[var(--muted)]">Pix/conta</div><Money centavos={totalPixContaMes} tamanho="sm" /></div>
            <div><div className="text-xs text-[var(--muted)]">Contas a pagar</div><Money centavos={contasPendentesRef} tamanho="sm" /></div>
          </div>
        </div>
      </Card>

      {/* ───── PANORAMA: pra onde o dinheiro foi neste mês ───── */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-medium text-[var(--text)]">Cartão de cada um</h3>
            <span className="text-sm text-[var(--text)]">Total <strong><Money centavos={totalFaturasMes} tamanho="sm" /></strong></span>
          </div>
          <p className="mb-4 text-xs text-[var(--muted)]">Fatura em aberto dos cartões de cada pessoa — onde estão caindo as compras {ehAtual ? "de agora" : `do fim de ${MESES[ref.mes - 1]}`}. Mesmo valor da tela Cartões.</p>
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

    </main>
  );
}

// Um dos três blocos do Caixa do mês. Com `cor`, vira o bloco de destaque (Livre).
function BlocoCaixa({ icone, rotulo, valor, sub, cor }: {
  icone: React.ReactNode; rotulo: string; valor: number; sub: string; cor?: string;
}) {
  const tom = cor ?? "var(--muted)";
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-[var(--radius-sm)] px-3 py-2.5"
      style={{ background: cor ? `color-mix(in srgb, ${cor} 10%, transparent)` : "var(--surface-2)" }}>
      <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: tom }}>{icone}{rotulo}</span>
      <span className="mono text-xl font-semibold" style={{ color: cor ?? "var(--text)" }}>{centavosParaReais(valor)}</span>
      <span className="text-xs" style={{ color: tom }}>{sub}</span>
    </div>
  );
}

// Uma linha da cascata do caixa: rótulo à esquerda, valor com sinal à direita.
function LinhaCascata({ rotulo, valor, forte, cor, sinal }: {
  rotulo: string; valor: number; forte?: boolean; cor?: string; sinal?: boolean;
}) {
  const texto = valor < 0
    ? `−${centavosParaReais(Math.abs(valor))}`
    : `${sinal && valor > 0 ? "+" : ""}${centavosParaReais(valor)}`;
  return (
    <div className={`flex items-baseline justify-between gap-3 ${forte ? "border-t border-[var(--border)] pt-1 font-semibold text-[var(--text)]" : "text-[var(--muted)]"}`}>
      <span className="min-w-0">{rotulo}</span>
      <span className="mono shrink-0" style={cor ? { color: cor } : undefined}>{texto}</span>
    </div>
  );
}
