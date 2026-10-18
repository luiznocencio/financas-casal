import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { saldoConta } from "@/lib/financeiro/derivados";
import { partesNoFuso, ultimoDiaDoMes } from "@/lib/financeiro/fechamento";
import { Money } from "@/components/ui/Money";
import { Card } from "@/components/ui/Card";
import { LinhaEditavel } from "@/components/lancamentos/LinhaEditavel";
import { todas } from "@/lib/supabase/todas";

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const ROTULO_TIPO: Record<string, string> = {
  corrente: "Conta corrente",
  dinheiro: "Dinheiro",
  poupanca: "Poupança",
};
const pad = (n: number) => String(n).padStart(2, "0");
const entrada = (tipo: string) => tipo === "receita" || tipo === "transferencia_entrada";

// Movimentação de uma conta: o que entrou e saiu no mês (pela data do lançamento),
// com o saldo no começo e no fim do mês.
export default async function ContaDetalhe({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mes?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createServerSupabase();

  const atual = partesNoFuso(new Date(), "America/Sao_Paulo");
  let ano = atual.ano, mes = atual.mes;
  if (sp.mes && /^\d{4}-\d{2}$/.test(sp.mes)) {
    const [a, m] = sp.mes.split("-").map(Number);
    if (m >= 1 && m <= 12) { ano = a; mes = m; }
  }
  const ehAtual = ano === atual.ano && mes === atual.mes;
  const mesPrev = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
  const mesProx = mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
  const hrefMes = (c: { ano: number; mes: number }) => `/contas/${id}?mes=${c.ano}-${pad(c.mes)}`;
  const ini = `${ano}-${pad(mes)}-01`;
  const fim = `${ano}-${pad(mes)}-${pad(ultimoDiaDoMes(ano, mes))}`;

  const [contaRes, txsRes, membrosRes, categoriasRes, cardsRes] = await Promise.all([
    supabase.from("accounts").select("*").eq("id", id).maybeSingle(),
    todas((de, ate) => supabase
      .from("transactions")
      .select("id, descricao, data_compra, pessoa, parcela_n, total_parcelas, tipo, valor_centavos, categoria_id, card_id, account_id, recorrente_id, observacao")
      .eq("account_id", id).order("id").range(de, ate)),
    supabase.from("members").select("nome"),
    supabase.from("categories").select("id, nome, cor, parent_id, tipo"),
    supabase.from("cards").select("id, nome"),
  ]);
  const erro = contaRes.error ?? txsRes.error ?? membrosRes.error ?? categoriasRes.error ?? cardsRes.error;
  if (erro) throw new Error(`Falha ao carregar a conta: ${erro.message}`);
  const conta = contaRes.data;
  if (!conta) notFound();

  const txs = txsRes.data ?? [];
  const membros = (membrosRes.data ?? []).map((m) => m.nome);
  const categorias = categoriasRes.data ?? [];
  const cartoes = cardsRes.data ?? [];

  const saldoAtual = saldoConta(conta.saldo_inicial_centavos, txs);
  const saldoInicioMes = saldoConta(conta.saldo_inicial_centavos, txs.filter((t) => t.data_compra < ini));
  const doMes = txs
    .filter((t) => t.data_compra >= ini && t.data_compra <= fim)
    .sort((a, b) => b.data_compra.localeCompare(a.data_compra) || a.id.localeCompare(b.id));
  const entrou = doMes.filter((t) => entrada(t.tipo)).reduce((s, t) => s + t.valor_centavos, 0);
  const saiu = doMes.filter((t) => !entrada(t.tipo)).reduce((s, t) => s + t.valor_centavos, 0);
  const saldoFimMes = saldoInicioMes + entrou - saiu;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <Link href="/contas" className="text-sm text-[var(--accent)]">‹ Contas</Link>

      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="break-words text-2xl font-semibold text-[var(--text)]">{conta.nome}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-[var(--muted)]">{ROTULO_TIPO[conta.tipo] ?? conta.tipo}</span>
            {conta.titular && (
              <span className="inline-flex w-fit items-center rounded-full bg-[var(--accent-weak)] px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
                {conta.titular}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs text-[var(--muted)]">Saldo hoje</span>
          <Money centavos={saldoAtual} sinal tamanho="lg" />
        </div>
      </header>

      <div className="flex items-center gap-1">
        <Link href={hrefMes(mesPrev)} aria-label="Mês anterior"
          className="rounded-md px-2 py-0.5 text-lg leading-none text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]">‹</Link>
        <span className="text-sm font-medium capitalize text-[var(--text)]">{MESES[mes - 1]}{ano !== atual.ano ? ` ${ano}` : ""}</span>
        <Link href={hrefMes(mesProx)} aria-label="Próximo mês"
          className="rounded-md px-2 py-0.5 text-lg leading-none text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]">›</Link>
        {!ehAtual && <Link href={`/contas/${id}`} className="ml-1 text-xs text-[var(--accent)]">hoje</Link>}
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div><div className="text-xs text-[var(--muted)]">Saldo no início</div><div className="text-lg"><Money centavos={saldoInicioMes} sinal /></div></div>
          <div><div className="text-xs text-[var(--muted)]">Entrou</div><div className="text-lg"><Money centavos={entrou} sinal /></div></div>
          <div><div className="text-xs text-[var(--muted)]">Saiu</div><div className="text-lg"><Money centavos={-saiu} sinal /></div></div>
          <div><div className="text-xs text-[var(--muted)]">{ehAtual ? "Saldo até agora" : "Saldo no fim"}</div><div className="text-lg"><Money centavos={saldoFimMes} sinal /></div></div>
        </div>
      </Card>

      {doMes.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">Nenhuma movimentação nesta conta em {MESES[mes - 1]}.</p>
        </Card>
      ) : (
        <Card>
          <div className="mb-1 border-b border-[var(--border)] pb-3 text-sm text-[var(--muted)]">
            {doMes.length} movimentaç{doMes.length === 1 ? "ão" : "ões"}
          </div>
          <ul className="flex flex-col gap-0">
            {doMes.map((t) => (
              <LinhaEditavel key={t.id} tx={t} categorias={categorias} membros={membros} cartoes={cartoes} />
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}
