import { createServerSupabase } from "@/lib/supabase/server";
import { Money } from "@/components/ui/Money";
import { Card } from "@/components/ui/Card";
import { agruparParcelas, type TxParcela } from "@/lib/importacao/parcelas";

export async function SecaoParcelas() {
  const supabase = await createServerSupabase();
  const [txsRes, cardsRes] = await Promise.all([
    supabase.from("transactions")
      .select("grupo_parcela, card_id, descricao, valor_centavos, total_parcelas, parcela_n")
      .gt("total_parcelas", 1).not("card_id", "is", null),
    supabase.from("cards").select("id, nome"),
  ]);
  const erro = txsRes.error ?? cardsRes.error;
  if (erro) throw new Error(`Falha ao carregar as parcelas: ${erro.message}`);

  const nomeCartao = new Map((cardsRes.data ?? []).map((c) => [c.id, c.nome]));
  const txs: TxParcela[] = (txsRes.data ?? []).map((t) => ({
    grupo_parcela: t.grupo_parcela,
    card_id: t.card_id,
    descricao: t.descricao,
    valor_centavos: t.valor_centavos,
    total_parcelas: t.total_parcelas,
    parcela_n: t.parcela_n,
    cartaoNome: t.card_id ? nomeCartao.get(t.card_id) ?? "cartão" : "cartão",
  }));
  const compras = agruparParcelas(txs);
  const ativas = compras.filter((c) => !c.quitada);
  const restanteTotal = ativas.reduce((s, c) => s + c.valorParcelaCentavos * c.faltam, 0);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-[var(--muted)]">
        Compras parceladas nos cartões e quantas parcelas faltam. Ao importar a fatura seguinte, a parcela é ligada automaticamente à mesma compra.
        {ativas.length > 0 && <> Ainda a pagar nas parceladas: <Money centavos={restanteTotal} tamanho="sm" />.</>}
      </p>

      {compras.length === 0 ? (
        <Card><p className="text-sm text-[var(--muted)]">Nenhuma compra parcelada por enquanto. Elas aparecem aqui quando você importa uma fatura com parcelas (ex.: “3/12”) ou lança uma compra parcelada.</p></Card>
      ) : (
        <Card>
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {compras.map((c) => {
              const pct = c.total > 0 ? (c.ultima / c.total) * 100 : 0;
              return (
                <div key={c.chave} className="flex flex-col gap-2 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="break-words font-medium text-[var(--text)]">{c.descricao}</span>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                        <span>{c.cartaoNome}</span>
                        <span>· <Money centavos={c.valorParcelaCentavos} tamanho="sm" />/mês</span>
                        {c.quitada
                          ? <span className="text-[var(--positivo)]">· quitada</span>
                          : <span className="text-[var(--alerta)]">· faltam {c.faltam}</span>}
                      </div>
                    </div>
                    <span className="mono text-sm text-[var(--muted)]">{c.ultima}/{c.total}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                    <div className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: c.quitada ? "var(--positivo)" : "var(--accent)" }} />
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
