"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { centavosParaReais } from "@/lib/financeiro/dinheiro";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { Repeat, UploadSimple } from "@phosphor-icons/react";
import { ordenarComSubcategorias } from "@/lib/ui/categorias";

type Linha = {
  data: string; descricao: string; valor_centavos: number;
  tipo: "despesa" | "receita"; total_parcelas: number;
  categoria_id: string | null; pessoa: string; incluir: boolean; duplicada?: boolean; fixo?: boolean;
};

export function Importador({
  cartoes, contas, categorias, membros,
}: {
  cartoes: { id: string; nome: string; titular?: string | null }[];
  contas: { id: string; nome: string; titular?: string | null }[];
  categorias: { id: string; nome: string; parent_id?: string | null }[]; membros: string[];
}) {
  const router = useRouter();
  const agora = new Date();
  const [origem, setOrigem] = useState(cartoes[0] ? `card:${cartoes[0].id}` : contas[0] ? `acc:${contas[0].id}` : "");
  const [comp, setComp] = useState(`${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`);
  const [texto, setTexto] = useState("");
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [lendoPdf, setLendoPdf] = useState(false);
  const [arqNome, setArqNome] = useState<string | null>(null);
  const [arquivoPdf, setArquivoPdf] = useState<File | null>(null);
  const [senhaPdf, setSenhaPdf] = useState("");
  const [precisaSenha, setPrecisaSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  async function lerArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setArqNome(f.name);
    setPrecisaSenha(false); setSenhaPdf(""); setArquivoPdf(null);
    const ehPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!ehPdf) { f.text().then(setTexto); return; }
    setArquivoPdf(f);
    await lerPdf(f);
  }

  // lê o PDF no servidor; se for protegido, pede a senha e tenta de novo com ela
  async function lerPdf(f: File, senha?: string) {
    setErro(null); setLendoPdf(true);
    try {
      const fd = new FormData();
      fd.append("arquivo", f);
      if (senha) fd.append("senha", senha);
      const r = await fetch("/api/importar/pdf", { method: "POST", body: fd }).then((x) => x.json());
      if (r.precisaSenha) {
        setPrecisaSenha(true);
        setErro(r.senhaErrada ? "Senha incorreta. Tente de novo." : "Esse PDF é protegido — informe a senha.");
        return;
      }
      if (!r.ok) { setErro(r.detalhe ? `Não consegui ler o PDF: ${r.detalhe}` : "Não consegui ler esse PDF. Tente colar o texto."); return; }
      setPrecisaSenha(false); setTexto(r.texto);
    } catch {
      setErro("Falha ao ler o PDF.");
    } finally {
      setLendoPdf(false);
    }
  }

  // dono da origem selecionada (cartão/conta) — vira a pessoa padrão das linhas
  function donoDaOrigem(): string {
    const [prefixo, id] = origem.split(":");
    const item = (prefixo === "card" ? cartoes : contas).find((x) => x.id === id);
    return item?.titular && membros.includes(item.titular) ? item.titular : (membros[0] ?? "conjunto");
  }

  async function analisar() {
    setErro(null); setCarregando(true); setLinhas(null);
    try {
      const [prefixo, id] = origem.split(":");
      const origemBody = id ? { [prefixo === "card" ? "card_id" : "account_id"]: id } : {};
      const [ano, mes] = comp.split("-").map(Number);
      const r = await fetch("/api/importar/analisar", {
        method: "POST",
        body: JSON.stringify({ texto, origem: origemBody, ...(prefixo === "card" ? { competencia: { ano, mes } } : {}) }),
      }).then((x) => x.json());
      if (!r.ok) { setErro("Não consegui ler os lançamentos desse texto. Confira e tente de novo."); return; }
      const dono = donoDaOrigem(); // fatura do cartão de alguém → atribui a essa pessoa
      setLinhas((r.linhas as Omit<Linha, "incluir" | "categoria_id" | "pessoa">[]).map((l) => {
        const dup = (l as { duplicada?: boolean }).duplicada ?? false;
        // já existe na origem → desmarcado por padrão (só adiciona os novos)
        return { ...l, incluir: !dup, categoria_id: (l as { categoria_id?: string | null }).categoria_id ?? null, pessoa: dono };
      }));
    } catch {
      setErro("Falha ao analisar. Tente de novo.");
    } finally {
      setCarregando(false);
    }
  }

  function atualizar(i: number, patch: Partial<Linha>) {
    setLinhas((ls) => ls!.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function confirmar() {
    if (!linhas) return;
    const [prefixo, id] = origem.split(":");
    const selecionadas = linhas.filter((l) => l.incluir).map((l) => ({
      data: l.data, descricao: l.descricao, valor_centavos: l.valor_centavos,
      tipo: l.tipo, total_parcelas: l.total_parcelas, categoria_id: l.categoria_id, pessoa: l.pessoa,
      fixo: l.fixo ?? false,
    }));
    const [ano, mes] = comp.split("-").map(Number);
    setCarregando(true);
    const r = await fetch("/api/importar/confirmar", {
      method: "POST",
      body: JSON.stringify({
        origem: { [prefixo === "card" ? "card_id" : "account_id"]: id },
        linhas: selecionadas,
        ...(prefixo === "card" ? { competencia: { ano, mes } } : {}),
      }),
    }).then((x) => x.json());
    setCarregando(false);
    setResultado(
      `Importados ${r.criadas ?? 0} lançamentos` +
        (r.duplicadas ? `, ${r.duplicadas} já existiam (pulados)` : "") +
        (r.fixosCriados ? `, ${r.fixosCriados} viraram gasto fixo` : "") +
        (r.falhas?.length ? `, ${r.falhas.length} falharam` : "") + ".",
    );
    setLinhas(null); setTexto("");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-col gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--muted)]">Origem dos lançamentos</span>
            <select value={origem} onChange={(e) => setOrigem(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--text)]">
              {cartoes.map((c) => <option key={c.id} value={`card:${c.id}`}>Cartão · {c.nome}{c.titular ? ` (${c.titular})` : ""}</option>)}
              {contas.map((c) => <option key={c.id} value={`acc:${c.id}`}>Conta · {c.nome}{c.titular ? ` (${c.titular})` : ""}</option>)}
            </select>
          </label>
          {origem.startsWith("card:") && (
            <label className="grid gap-1 text-sm">
              <span className="text-[var(--muted)]">Mês da fatura (tudo entra nesta fatura)</span>
              <input type="month" value={comp} onChange={(e) => setComp(e.target.value)}
                className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-2 text-[var(--text)]" />
            </label>
          )}
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={6}
            placeholder="Cole aqui o extrato/fatura (ou o conteúdo do CSV)..."
            className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-2 font-mono text-sm text-[var(--text)]" />
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] hover:border-[var(--accent)]">
              <UploadSimple size={15} /> Escolher arquivo
              <input type="file" accept=".csv,.txt,.ofx,.pdf,text/plain,application/pdf" onChange={lerArquivo} disabled={lendoPdf} className="hidden" />
            </label>
            {arqNome && !lendoPdf && <span className="min-w-0 truncate text-xs text-[var(--muted)]">{arqNome}</span>}
            {lendoPdf && (
              <span className="flex items-center gap-2 text-sm text-[var(--muted)]"><Spinner size={14} /> Lendo PDF...</span>
            )}
            <Button variant="primary" onClick={analisar} disabled={carregando || lendoPdf || !texto} style={{ marginLeft: "auto" }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {carregando && <Spinner size={14} />}
                {carregando ? "Analisando..." : "Analisar"}
              </span>
            </Button>
          </div>
          {precisaSenha && arquivoPdf && (
            <div className="flex flex-wrap items-center gap-2">
              <input type="password" value={senhaPdf} onChange={(e) => setSenhaPdf(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && senhaPdf) lerPdf(arquivoPdf, senhaPdf); }}
                placeholder="Senha do PDF" autoFocus
                className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]" />
              <Button variant="primary" onClick={() => lerPdf(arquivoPdf, senhaPdf)} disabled={lendoPdf || !senhaPdf}>
                Abrir com senha
              </Button>
              <span className="text-xs text-[var(--muted)]">A senha da fatura do Itaú costuma ser os dígitos do CPF do titular.</span>
            </div>
          )}
          {erro && <p className="text-sm text-[var(--negativo)]">{erro}</p>}
          {resultado && <p className="text-sm text-[var(--positivo)]">{resultado}</p>}
        </div>
      </Card>

      {linhas && (
        <Card>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-col">
              <span className="font-medium text-[var(--text)]">{linhas.length} lançamentos encontrados</span>
              {linhas.some((l) => l.duplicada) && (
                <span className="text-xs text-[var(--muted)]">
                  {linhas.filter((l) => l.duplicada).length} já constam e vieram desmarcados
                </span>
              )}
              {origem.startsWith("card:") && (
                <span className="text-xs text-[var(--muted)]">Marque <strong>fixo</strong> num lançamento pra virar gasto fixo e mapear nas próximas faturas.</span>
              )}
            </div>
            <Button variant="primary" onClick={confirmar} disabled={carregando}>
              Importar {linhas.filter((l) => l.incluir).length}
            </Button>
          </div>
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {linhas.map((l, i) => (
              <div key={i} className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <input type="checkbox" checked={l.incluir} onChange={(e) => atualizar(i, { incluir: e.target.checked })} />
                  <input value={l.descricao} onChange={(e) => atualizar(i, { descricao: e.target.value })}
                    className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[var(--text)]" />
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-6 sm:flex-1 sm:pl-0">
                  <span className="w-full text-xs text-[var(--muted)] sm:w-20 sm:text-sm">{l.data}</span>
                  <select value={l.categoria_id ?? ""} onChange={(e) => atualizar(i, { categoria_id: e.target.value || null })}
                    className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-1 text-[var(--text)] sm:flex-none">
                    <option value="">—</option>
                    {ordenarComSubcategorias(categorias).map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
                  </select>
                  <span className="mono ml-auto text-right sm:ml-0 sm:w-24">{centavosParaReais(l.valor_centavos)}</span>
                  {origem.startsWith("card:") && (
                    <button type="button" onClick={() => atualizar(i, { fixo: !l.fixo })}
                      title={l.fixo ? "Marcado como gasto fixo (mapeia nas próximas faturas)" : "Marcar como gasto fixo"}
                      className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                      style={{
                        borderColor: l.fixo ? "var(--accent)" : "var(--border)",
                        background: l.fixo ? "var(--accent-weak)" : "transparent",
                        color: l.fixo ? "var(--accent)" : "var(--muted)",
                      }}>
                      <Repeat size={12} weight={l.fixo ? "fill" : "regular"} /> fixo
                    </button>
                  )}
                  {l.duplicada && <span className="w-full text-xs text-[var(--alerta)] sm:w-auto">já lançado</span>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
