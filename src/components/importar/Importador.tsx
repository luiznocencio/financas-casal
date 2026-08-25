"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { centavosParaReais } from "@/lib/financeiro/dinheiro";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";

type Linha = {
  data: string; descricao: string; valor_centavos: number;
  tipo: "despesa" | "receita"; total_parcelas: number;
  categoria_id: string | null; pessoa: string; incluir: boolean; duplicada?: boolean;
};

export function Importador({
  cartoes, contas, categorias, membros,
}: {
  cartoes: { id: string; nome: string }[]; contas: { id: string; nome: string }[];
  categorias: { id: string; nome: string }[]; membros: string[];
}) {
  const router = useRouter();
  const [origem, setOrigem] = useState(cartoes[0] ? `card:${cartoes[0].id}` : contas[0] ? `acc:${contas[0].id}` : "");
  const [texto, setTexto] = useState("");
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [lendoPdf, setLendoPdf] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  async function lerArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const ehPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!ehPdf) { f.text().then(setTexto); return; }
    setErro(null); setLendoPdf(true);
    try {
      const fd = new FormData();
      fd.append("arquivo", f);
      const r = await fetch("/api/importar/pdf", { method: "POST", body: fd }).then((x) => x.json());
      if (!r.ok) { setErro("Não consegui ler esse PDF. Tente colar o texto."); return; }
      setTexto(r.texto);
    } catch {
      setErro("Falha ao ler o PDF.");
    } finally {
      setLendoPdf(false);
    }
  }

  async function analisar() {
    setErro(null); setCarregando(true); setLinhas(null);
    try {
      const r = await fetch("/api/importar/analisar", { method: "POST", body: JSON.stringify({ texto }) }).then((x) => x.json());
      if (!r.ok) { setErro("Não consegui ler os lançamentos desse texto. Confira e tente de novo."); return; }
      setLinhas((r.linhas as Omit<Linha, "incluir" | "categoria_id" | "pessoa">[]).map((l) => ({
        ...l, incluir: true, categoria_id: null, pessoa: membros[0] ?? "conjunto",
      })));
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
    }));
    setCarregando(true);
    const r = await fetch("/api/importar/confirmar", {
      method: "POST",
      body: JSON.stringify({ origem: { [prefixo === "card" ? "card_id" : "account_id"]: id }, linhas: selecionadas }),
    }).then((x) => x.json());
    setCarregando(false);
    setResultado(
      `Importados ${r.criadas ?? 0} lançamentos` +
        (r.duplicadas ? `, ${r.duplicadas} já existiam (pulados)` : "") +
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
              {cartoes.map((c) => <option key={c.id} value={`card:${c.id}`}>Cartão · {c.nome}</option>)}
              {contas.map((c) => <option key={c.id} value={`acc:${c.id}`}>Conta · {c.nome}</option>)}
            </select>
          </label>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={6}
            placeholder="Cole aqui o extrato/fatura (ou o conteúdo do CSV)..."
            className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-2 font-mono text-sm text-[var(--text)]" />
          <div className="flex items-center gap-3">
            <input type="file" accept=".csv,.txt,.ofx,.pdf,text/plain,application/pdf" onChange={lerArquivo} disabled={lendoPdf} className="text-sm text-[var(--muted)]" />
            {lendoPdf && (
              <span className="flex items-center gap-2 text-sm text-[var(--muted)]"><Spinner size={14} /> Lendo PDF...</span>
            )}
            <Button variant="primary" onClick={analisar} disabled={carregando || lendoPdf || !texto}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {carregando && <Spinner size={14} />}
                {carregando ? "Analisando..." : "Analisar"}
              </span>
            </Button>
          </div>
          {erro && <p className="text-sm text-[var(--negativo)]">{erro}</p>}
          {resultado && <p className="text-sm text-[var(--positivo)]">{resultado}</p>}
        </div>
      </Card>

      {linhas && (
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium text-[var(--text)]">{linhas.length} lançamentos encontrados</span>
            <Button variant="primary" onClick={confirmar} disabled={carregando}>
              Importar {linhas.filter((l) => l.incluir).length}
            </Button>
          </div>
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {linhas.map((l, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <input type="checkbox" checked={l.incluir} onChange={(e) => atualizar(i, { incluir: e.target.checked })} />
                <span className="w-20 text-[var(--muted)]">{l.data}</span>
                <input value={l.descricao} onChange={(e) => atualizar(i, { descricao: e.target.value })}
                  className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[var(--text)]" />
                <select value={l.categoria_id ?? ""} onChange={(e) => atualizar(i, { categoria_id: e.target.value || null })}
                  className="rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-1 text-[var(--text)]">
                  <option value="">—</option>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                <span className="mono w-24 text-right">{centavosParaReais(l.valor_centavos)}</span>
                {l.duplicada && <span className="text-xs text-[var(--negativo)]">possível duplicado</span>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
