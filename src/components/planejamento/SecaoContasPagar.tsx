import { createServerSupabase } from "@/lib/supabase/server";
import { partesNoFuso, ultimoDiaDoMes } from "@/lib/financeiro/fechamento";
import { proximoVencimento } from "@/lib/financeiro/vencimento";
import { contaVisivelNoMes } from "@/lib/financeiro/contas";
import { Money } from "@/components/ui/Money";
import { Card } from "@/components/ui/Card";
import { CategoriaTag } from "@/components/ui/CategoriaTag";
import { AddContaPagar } from "@/components/contas-pagar/AddContaPagar";
import { ContaPagarAcoes } from "@/components/contas-pagar/ContaPagarAcoes";
import type { ContaPagar } from "@/lib/db/tipos";

const pad = (n: number) => String(n).padStart(2, "0");

export async function SecaoContasPagar() {
  const supabase = await createServerSupabase();
  const { ano, mes, dia: hojeDia } = partesNoFuso(new Date(), "America/Sao_Paulo");
  const ini = `${ano}-${pad(mes)}-01`;
  const fim = `${ano}-${pad(mes)}-${pad(ultimoDiaDoMes(ano, mes))}`;

  const [cpRes, catsRes, contasRes, membrosRes, pagasRes] = await Promise.all([
    supabase.from("contas_pagar").select("*").eq("ativo", true).order("dia_vencimento"),
    supabase.from("categories").select("id, nome, cor").eq("tipo", "despesa").order("nome"),
    supabase.from("accounts").select("id, nome, titular").order("nome"),
    supabase.from("members").select("nome"),
    supabase.from("transactions").select("conta_pagar_id, valor_centavos, data_compra")
      .not("conta_pagar_id", "is", null),
  ]);
  const erro = cpRes.error ?? catsRes.error ?? contasRes.error ?? membrosRes.error ?? pagasRes.error;
  if (erro) throw new Error(`Falha ao carregar as contas a pagar: ${erro.message}`);

  const contasPagar = (cpRes.data ?? []) as ContaPagar[];
  const cats = catsRes.data ?? [];
  const contas = contasRes.data ?? [];
  const membros = (membrosRes.data ?? []).map((m) => m.nome);

  const catById = new Map(cats.map((c) => [c.id, c]));
  const pagoNoMes = new Map<string, number>(); // conta_pagar_id -> valor pago neste mês
  const pagaAlgumaVez = new Set<string>();      // conta_pagar_id -> já paga em qualquer mês
  for (const t of pagasRes.data ?? []) {
    if (!t.conta_pagar_id) continue;
    pagaAlgumaVez.add(t.conta_pagar_id);
    if (t.data_compra >= ini && t.data_compra <= fim) pagoNoMes.set(t.conta_pagar_id, t.valor_centavos);
  }
  const categoriaPadrao = cats.find((c) => c.nome === "Contas de casa")?.id ?? "";

  // só as contas com cobrança devida neste mês (mensal respeita data_fim; única só no mês dela)
  const visiveis = contasPagar.filter((c) =>
    contaVisivelNoMes(c, ano, mes, pagaAlgumaVez.has(c.id), pagoNoMes.has(c.id)));
  const pendentes = visiveis.filter((c) => !pagoNoMes.has(c.id));
  const totalEstimado = pendentes.reduce((s, c) => s + (c.valor_estimado_centavos ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-[var(--muted)]">
        Contas de valor variável (água, energia, internet…): vencimento e lembrete. Ao pagar, você informa o valor e escolhe a conta de onde sai.
        {totalEstimado > 0 && <> Estimado pendente: <Money centavos={totalEstimado} tamanho="sm" />.</>}
      </p>

      <AddContaPagar categorias={cats} membros={membros} categoriaPadrao={categoriaPadrao} />

      {visiveis.length === 0 ? (
        <Card><p className="text-sm text-[var(--muted)]">Nenhuma conta para este mês. Adicione as fixas do mês (ex.: energia, água, internet).</p></Card>
      ) : (
        <Card>
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {visiveis.map((c) => {
              const cat = c.categoria_id ? catById.get(c.categoria_id) : null;
              const pago = pagoNoMes.get(c.id);
              const jaPaga = pago != null;
              const venc = proximoVencimento(c.dia_vencimento, { ano, mes, dia: hojeDia }, c.created_at, jaPaga);
              const dataVenc = `${pad(venc.dia)}/${pad(venc.mes)}`;
              return (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="break-words font-medium text-[var(--text)]">{c.descricao}</span>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                      {jaPaga
                        ? <span className="text-[var(--positivo)]">pago: <Money centavos={pago!} tamanho="sm" /></span>
                        : <span style={venc.atrasada ? { color: "var(--alerta)" } : undefined}>{venc.atrasada ? "venceu " : "vence "}{dataVenc}</span>}
                      <span>· {c.pessoa}</span>
                      {cat && <CategoriaTag nome={cat.nome} cor={cat.cor} tamanho="sm" />}
                      {c.valor_estimado_centavos != null && !jaPaga && <span>· ~<Money centavos={c.valor_estimado_centavos} tamanho="sm" /></span>}
                    </div>
                  </div>
                  <ContaPagarAcoes id={c.id} valorEstimado={c.valor_estimado_centavos ?? 0} jaPaga={jaPaga} contas={contas} />
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
