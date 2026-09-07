"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilSimple, Check, X, ArrowsMerge } from "@phosphor-icons/react";
import { Money } from "@/components/ui/Money";
import { Button } from "@/components/ui/Button";

export type CompraView = {
  chave: string;
  descricao: string;
  cartaoNome: string;
  valorParcelaCentavos: number;
  total: number;
  ultima: number;
  faltam: number;
  quitada: boolean;
  txIds: string[];
};

export function ParcelasLista({ compras }: { compras: CompraView[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [mesclando, setMesclando] = useState(false);
  const [selecao, setSelecao] = useState<Set<string>>(new Set());

  async function renomear(txIds: string[]) {
    if (!nome.trim()) { setEditando(null); return; }
    setOcupado(true);
    const res = await fetch("/api/parcelas", {
      method: "POST", body: JSON.stringify({ acao: "renomear", txIds, nome: nome.trim() }),
    }).then((x) => x.json()).catch(() => null);
    setOcupado(false);
    if (!res?.ok) { setAviso("Não foi possível renomear."); return; }
    setEditando(null); setAviso(null); router.refresh();
  }

  async function mesclar() {
    const marcadas = compras.filter((c) => selecao.has(c.chave));
    const txIds = marcadas.flatMap((c) => c.txIds);
    if (marcadas.length < 2 || txIds.length < 2) return;
    setOcupado(true);
    const res = await fetch("/api/parcelas", {
      method: "POST", body: JSON.stringify({ acao: "mesclar", txIds }),
    }).then((x) => x.json()).catch(() => null);
    setOcupado(false);
    if (!res?.ok) { setAviso("Não foi possível mesclar."); return; }
    setMesclando(false); setSelecao(new Set()); setAviso(null); router.refresh();
  }

  function toggle(chave: string) {
    setSelecao((s) => { const n = new Set(s); n.has(chave) ? n.delete(chave) : n.add(chave); return n; });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-[var(--muted)]">
          {mesclando ? "Selecione as compras que são a mesma e junte." : "Toque no lápis pra renomear uma compra."}
        </span>
        {mesclando ? (
          <Button variant="quiet" tamanho="md" onClick={() => { setMesclando(false); setSelecao(new Set()); }}
            style={{ padding: "8px 12px", fontSize: "0.75rem" }}>Cancelar</Button>
        ) : (
          <Button variant="ghost" tamanho="md" onClick={() => setMesclando(true)}
            style={{ padding: "8px 12px", fontSize: "0.75rem" }}>
            <ArrowsMerge size={14} /> Mesclar duplicadas
          </Button>
        )}
      </div>

      {aviso && <p className="text-sm text-[var(--negativo)]">{aviso}</p>}

      <div className="flex flex-col divide-y divide-[var(--border)]">
        {compras.map((c) => {
          const pct = c.total > 0 ? (c.ultima / c.total) * 100 : 0;
          const emEdicao = editando === c.chave;
          const marcada = selecao.has(c.chave);
          return (
            <div key={c.chave} className="flex flex-col gap-2 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {mesclando && (
                    <input type="checkbox" checked={marcada} onChange={() => toggle(c.chave)}
                      className="h-4 w-4 shrink-0" aria-label={`Selecionar ${c.descricao}`} />
                  )}
                  {emEdicao ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") renomear(c.txIds); if (e.key === "Escape") setEditando(null); }}
                        placeholder="Nome da compra"
                        className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[var(--text)]" />
                      <Button variant="primary" tamanho="md" onClick={() => renomear(c.txIds)} disabled={ocupado}
                        style={{ padding: "9px 10px" }} aria-label="Salvar nome"><Check size={14} /></Button>
                      <Button variant="quiet" tamanho="md" onClick={() => setEditando(null)}
                        style={{ padding: "9px 10px" }} aria-label="Cancelar"><X size={14} /></Button>
                    </div>
                  ) : (
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
                  )}
                </div>
                {!emEdicao && (
                  <div className="flex items-center gap-2">
                    <span className="mono text-sm text-[var(--muted)]">{c.ultima}/{c.total}</span>
                    {!mesclando && (
                      <Button variant="ghost" tamanho="md" onClick={() => { setEditando(c.chave); setNome(c.descricao); }}
                        style={{ padding: "9px 9px" }} aria-label="Renomear compra"><PencilSimple size={13} /></Button>
                    )}
                  </div>
                )}
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: c.quitada ? "var(--positivo)" : "var(--accent)" }} />
              </div>
            </div>
          );
        })}
      </div>

      {mesclando && (
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
          <span className="text-sm text-[var(--muted)]">{selecao.size} selecionada(s)</span>
          <Button variant="primary" onClick={mesclar} disabled={ocupado || selecao.size < 2}>
            Mesclar selecionadas
          </Button>
        </div>
      )}
    </div>
  );
}
