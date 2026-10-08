import { createServerSupabase } from "@/lib/supabase/server";
import { partesNoFuso, ultimoDiaDoMes } from "@/lib/financeiro/fechamento";
import { contaOcorreNoMes, mesesEmAberto, quitadosPorConta, mesQuitado, chaveMes, type Mes } from "@/lib/financeiro/contas";
import { Money } from "@/components/ui/Money";
import { Card } from "@/components/ui/Card";
import { CategoriaTag } from "@/components/ui/CategoriaTag";
import { AddContaPagar } from "@/components/contas-pagar/AddContaPagar";
import { ContaPagarAcoes } from "@/components/contas-pagar/ContaPagarAcoes";
import type { ContaPagar } from "@/lib/db/tipos";
import { todas } from "@/lib/supabase/todas";

const pad = (n: number) => String(n).padStart(2, "0");
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export async function SecaoContasPagar() {
  const supabase = await createServerSupabase();
  const { ano, mes, dia: hojeDia } = partesNoFuso(new Date(), "America/Sao_Paulo");
  const hoje = `${ano}-${pad(mes)}-${pad(hojeDia)}`;
  const atual: Mes = { ano, mes };

  const [cpRes, catsRes, contasRes, membrosRes, pagasRes] = await Promise.all([
    supabase.from("contas_pagar").select("*").eq("ativo", true).order("dia_vencimento"),
    supabase.from("categories").select("id, nome, cor").eq("tipo", "despesa").order("nome"),
    supabase.from("accounts").select("id, nome, titular").order("nome"),
    supabase.from("members").select("nome"),
    todas((de, ate) => supabase.from("transactions").select("conta_pagar_id, conta_pagar_ref, valor_centavos, data_compra")
      .not("conta_pagar_id", "is", null).order("id").range(de, ate)),
  ]);
  const erro = cpRes.error ?? catsRes.error ?? contasRes.error ?? membrosRes.error ?? pagasRes.error;
  if (erro) throw new Error(`Falha ao carregar as contas a pagar: ${erro.message}`);

  const contasPagar = (cpRes.data ?? []) as ContaPagar[];
  const cats = catsRes.data ?? [];
  const contas = contasRes.data ?? [];
  const membros = (membrosRes.data ?? []).map((m) => m.nome);

  const catById = new Map(cats.map((c) => [c.id, c]));
  const quitados = quitadosPorConta(pagasRes.data ?? []);
  const valorPago = new Map<string, number>(); // "conta|YYYY-MM" -> valor pago
  for (const t of pagasRes.data ?? []) {
    if (!t.conta_pagar_id) continue;
    const k = `${t.conta_pagar_id}|${mesQuitado(t)}`;
    valorPago.set(k, (valorPago.get(k) ?? 0) + t.valor_centavos);
  }
  const categoriaPadrao = cats.find((c) => c.nome === "Contas de casa")?.id ?? "";

  // uma linha por COBRANÇA: os meses em aberto (inclusive atrasados de meses
  // anteriores — conta não paga não some na virada do mês) + a deste mês já paga
  type Linha = { c: ContaPagar; m: Mes; venc: string; atrasada: boolean; pago: number | null };
  const linhas: Linha[] = [];
  for (const c of contasPagar) {
    const q = quitados.get(c.id) ?? new Set<string>();
    const meses = mesesEmAberto(c, q, atual);
    if (contaOcorreNoMes(c, ano, mes) && q.has(chaveMes(atual))) meses.push(atual);
    for (const m of meses) {
      const venc = `${m.ano}-${pad(m.mes)}-${pad(Math.min(c.dia_vencimento, ultimoDiaDoMes(m.ano, m.mes)))}`;
      const pagoK = valorPago.get(`${c.id}|${chaveMes(m)}`);
      const pago = q.has(chaveMes(m)) ? pagoK ?? 0 : null;
      linhas.push({ c, m, venc, atrasada: pago == null && venc < hoje, pago });
    }
  }
  // atrasadas primeiro, depois por vencimento; pagas no fim
  linhas.sort((a, b) => Number(a.pago != null) - Number(b.pago != null) || Number(b.atrasada) - Number(a.atrasada) || a.venc.localeCompare(b.venc));
  const pendentes = linhas.filter((l) => l.pago == null);
  const totalEstimado = pendentes.reduce((s, l) => s + (l.c.valor_estimado_centavos ?? 0), 0);
  const atrasadas = pendentes.filter((l) => l.atrasada).length;
  // a lixeira (apaga a conta inteira) fica numa linha só por conta
  const comLixeira = new Set<string>();
  const lixeiraEm = new Set<Linha>();
  for (const l of linhas) if (!comLixeira.has(l.c.id)) { comLixeira.add(l.c.id); lixeiraEm.add(l); }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-[var(--muted)]">
        Contas de valor variável (água, energia, internet…): vencimento e lembrete. Ao pagar, você informa o valor e escolhe a conta de onde sai.
        {totalEstimado > 0 && <> Estimado pendente: <Money centavos={totalEstimado} tamanho="sm" />.</>}
        {atrasadas > 0 && <span style={{ color: "var(--alerta)" }}> {atrasadas} em atraso.</span>}
      </p>

      <AddContaPagar categorias={cats} membros={membros} categoriaPadrao={categoriaPadrao} />

      {linhas.length === 0 ? (
        <Card><p className="text-sm text-[var(--muted)]">Nenhuma conta para este mês. Adicione as fixas do mês (ex.: energia, água, internet).</p></Card>
      ) : (
        <Card>
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {linhas.map((linha) => {
              const { c, m, venc, atrasada, pago } = linha;
              const cat = c.categoria_id ? catById.get(c.categoria_id) : null;
              const jaPaga = pago != null;
              const dataVenc = `${venc.slice(8, 10)}/${venc.slice(5, 7)}`;
              const deOutroMes = m.ano !== ano || m.mes !== mes;
              return (
                <div key={`${c.id}|${chaveMes(m)}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="break-words font-medium text-[var(--text)]">
                      {c.descricao}
                      {deOutroMes && <span className="ml-1.5 text-xs font-normal capitalize text-[var(--muted)]">· {MESES[m.mes - 1]}{m.ano !== ano ? ` ${m.ano}` : ""}</span>}
                    </span>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                      {jaPaga
                        ? <span className="text-[var(--positivo)]">pago: <Money centavos={pago} tamanho="sm" /></span>
                        : <span style={atrasada ? { color: "var(--alerta)" } : undefined}>{atrasada ? "venceu " : "vence "}{dataVenc}</span>}
                      <span>· {c.pessoa}</span>
                      {cat && <CategoriaTag nome={cat.nome} cor={cat.cor} tamanho="sm" />}
                      {c.valor_estimado_centavos != null && !jaPaga && <span>· ~<Money centavos={c.valor_estimado_centavos} tamanho="sm" /></span>}
                    </div>
                  </div>
                  <ContaPagarAcoes id={c.id} mesRef={chaveMes(m)} hoje={hoje} valorEstimado={c.valor_estimado_centavos ?? 0}
                    jaPaga={jaPaga} podeApagar={lixeiraEm.has(linha)} contas={contas} />
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
