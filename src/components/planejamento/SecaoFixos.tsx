import { createServerSupabase } from "@/lib/supabase/server";
import { partesNoFuso, ultimoDiaDoMes } from "@/lib/financeiro/fechamento";
import { Money } from "@/components/ui/Money";
import { Card } from "@/components/ui/Card";
import { CategoriaTag } from "@/components/ui/CategoriaTag";
import { AddRecorrente } from "@/components/recorrentes/AddRecorrente";
import { GerarFixos } from "@/components/recorrentes/GerarFixos";
import { RemoverRecorrente } from "@/components/recorrentes/RemoverRecorrente";
import { recorrenteJaLancado } from "@/lib/financeiro/recorrentes";
import type { Recorrente } from "@/lib/db/tipos";

const pad = (n: number) => String(n).padStart(2, "0");

export async function SecaoFixos() {
  const supabase = await createServerSupabase();
  const { ano, mes } = partesNoFuso(new Date(), "America/Sao_Paulo");
  const ini = `${ano}-${pad(mes)}-01`;
  const fim = `${ano}-${pad(mes)}-${pad(ultimoDiaDoMes(ano, mes))}`;

  const cols = "recorrente_id, descricao, valor_centavos, card_id, account_id, invoice_id";
  const [recRes, catsRes, cardsRes, contasRes, membrosRes, invRes, contaTxRes, cartaoTxRes] = await Promise.all([
    supabase.from("recorrentes").select("*").order("dia"),
    supabase.from("categories").select("id, nome, cor"),
    supabase.from("cards").select("id, nome, titular").order("nome"),
    supabase.from("accounts").select("id, nome, titular").order("nome"),
    supabase.from("members").select("nome"),
    supabase.from("invoices").select("id, competencia_ano, competencia_mes"),
    // conta/pix: lançamentos do mês pela data
    supabase.from("transactions").select(cols).not("account_id", "is", null).gte("data_compra", ini).lte("data_compra", fim),
    // cartão: lançamentos com fatura (filtra pela competência deste mês abaixo)
    supabase.from("transactions").select(cols).not("card_id", "is", null),
  ]);
  const erro = recRes.error ?? catsRes.error ?? cardsRes.error ?? contasRes.error ?? membrosRes.error ?? invRes.error ?? contaTxRes.error ?? cartaoTxRes.error;
  if (erro) throw new Error(`Falha ao carregar os gastos fixos: ${erro.message}`);

  const recorrentes = (recRes.data ?? []) as Recorrente[];
  const cats = catsRes.data ?? [];
  const cartoes = cardsRes.data ?? [];
  const contas = contasRes.data ?? [];
  const membros = (membrosRes.data ?? []).map((m) => m.nome);
  // lançamentos que já existem neste mês: conta por data + cartão pela competência da fatura
  const invCompRef = new Set((invRes.data ?? []).filter((i) => i.competencia_ano === ano && i.competencia_mes === mes).map((i) => i.id));
  const cartaoMes = (cartaoTxRes.data ?? []).filter((t) => t.invoice_id && invCompRef.has(t.invoice_id));
  const existentes = [...(contaTxRes.data ?? []), ...cartaoMes];
  const jaLancado = (r: Recorrente) => recorrenteJaLancado(r, existentes);

  const catById = new Map(cats.map((c) => [c.id, c]));
  const origemNome = (r: Recorrente) =>
    r.card_id ? `Cartão · ${cartoes.find((c) => c.id === r.card_id)?.nome ?? "?"}`
      : `Conta · ${contas.find((c) => c.id === r.account_id)?.nome ?? "?"}`;
  const pendentes = recorrentes.filter((r) => r.ativo && !jaLancado(r)).length;
  const totalMes = recorrentes.filter((r) => r.ativo).reduce((s, r) => s + r.valor_centavos, 0);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-[var(--muted)]">
        Valor fixo que se repete todo mês (ex.: Netflix, aluguel). Some <Money centavos={totalMes} tamanho="sm" /> por mês. Para contas de <strong>valor variável</strong> (água, energia), use a aba <strong>Contas a pagar</strong>.
      </p>

      <GerarFixos pendentes={pendentes} />

      <AddRecorrente cartoes={cartoes} contas={contas} categorias={cats} membros={membros} />

      {recorrentes.length === 0 ? (
        <Card><p className="text-sm text-[var(--muted)]">Nenhum gasto fixo ainda. Cadastre o primeiro (ex.: aluguel, streaming, academia).</p></Card>
      ) : (
        <Card>
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {recorrentes.map((r) => {
              const cat = r.categoria_id ? catById.get(r.categoria_id) : null;
              const lancado = jaLancado(r);
              return (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="break-words font-medium text-[var(--text)]">{r.descricao}</span>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                      <span>dia {r.dia}</span>
                      <span>· {origemNome(r)}</span>
                      {r.data_fim && <span>· até {new Date(r.data_fim + "T12:00:00").toLocaleDateString("pt-BR")}</span>}
                      {cat && <CategoriaTag nome={cat.nome} cor={cat.cor} tamanho="sm" />}
                      {lancado
                        ? <span className="text-[var(--positivo)]">lançado este mês</span>
                        : <span className="text-[var(--alerta)]">pendente</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Money centavos={r.valor_centavos} />
                    <RemoverRecorrente id={r.id} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
