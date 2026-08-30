import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { saldoConta, limiteDisponivel } from "@/lib/financeiro/derivados";
import { resumoDoMes } from "@/lib/financeiro/agregacoes";
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
    supabase.from("members").select("nome"),
    supabase.from("invoices").select("id, competencia_ano, competencia_mes"),
    supabase.from("contas_pagar").select("id, valor_estimado_centavos").eq("ativo", true),
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

  // "dá pra pagar o pendente?": dinheiro em conta vs (faturas abertas + contas a pagar do mês)
  const pagoContaMes = new Set((txs ?? [])
    .filter((t) => { if (!t.conta_pagar_id) return false; const [a, m] = t.data_compra.split("-").map(Number); return a === ref.ano && m === ref.mes; })
    .map((t) => t.conta_pagar_id));
  const pendenteContas = (contasPagarRes.data ?? [])
    .filter((c) => !pagoContaMes.has(c.id)).reduce((s, c) => s + (c.valor_estimado_centavos ?? 0), 0);
  const aPagar = comprometido + pendenteContas;
  const sobra = saldoTotal - aPagar;

  const resumo = resumoDoMes(txsRef, ref);
  const catById = new Map((cats ?? []).map((c) => [c.id, c]));
  const nomeCat = (id: string) => catById.get(id)?.nome ?? "Outros";
  const corCat = (id: string) => catById.get(id)?.cor ?? "#6b7280";
  const porPessoa = Object.entries(resumo.porPessoa).sort((a, b) => b[1] - a[1]);
  const topCategorias = Object.entries(resumo.porCategoria).sort((a, b) => b[1] - a[1]);
  const maiorCategoria = topCategorias.length ? topCategorias[0][1] : 0;

  const stats = [
    { rotulo: "Saldo em contas", valor: saldoTotal, sinal: true },
    { rotulo: "Faturas abertas", valor: comprometido, sinal: false },
    { rotulo: "Despesas do mês", valor: resumo.totalDespesas, sinal: false },
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

      {/* dá pra pagar o pendente? saldo em conta vs (faturas abertas + contas a pagar) */}
      <div className="rounded-[var(--radius)] border px-4 py-3"
        style={{ borderColor: sobra >= 0 ? "var(--positivo)" : "var(--negativo)", background: `color-mix(in srgb, ${sobra >= 0 ? "var(--positivo)" : "var(--negativo)"} 8%, transparent)` }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-medium text-[var(--text)]">
              {sobra >= 0 ? "Dá pra pagar o pendente" : "Falta pra pagar o pendente"}
            </span>
            <span className="text-xs text-[var(--muted)]">
              Saldo <Money centavos={saldoTotal} tamanho="sm" /> − a pagar <Money centavos={aPagar} tamanho="sm" /> (faturas + contas)
            </span>
          </div>
          <span className="mono text-lg font-semibold" style={{ color: sobra >= 0 ? "var(--positivo)" : "var(--negativo)" }}>
            {sobra >= 0 ? "sobra " : "falta "}{centavosParaReais(Math.abs(sobra))}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <h3 className="mb-4 font-medium text-[var(--text)]">Quem gastou este mês</h3>
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
