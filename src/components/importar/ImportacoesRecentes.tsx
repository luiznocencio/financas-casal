"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash, ArrowsLeftRight } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";

export type LoteImportacao = {
  grupo: string;
  quantidade: number;
  totalCentavos: number;
  dataMaisRecente: string;
  origemNome?: string | null;
};

type CartaoOpt = { id: string; nome: string; titular?: string | null };

function LinhaImportacao({ lote, cartoes }: { lote: LoteImportacao; cartoes: CartaoOpt[] }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [movendoAberto, setMovendoAberto] = useState(false);
  const [destino, setDestino] = useState(cartoes[0]?.id ?? "");
  const [movendo, setMovendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function apagar() {
    setErro(null); setExcluindo(true);
    const res = await fetch(`/api/importar/${lote.grupo}`, { method: "DELETE" }).catch(() => null);
    setExcluindo(false);
    if (!res?.ok) { setErro("Não foi possível apagar a importação."); return; }
    router.refresh();
  }

  async function mover() {
    if (!destino) return;
    setErro(null); setMovendo(true);
    const res = await fetch(`/api/importar/${lote.grupo}`, {
      method: "PATCH", body: JSON.stringify({ card_id: destino }),
    }).catch(() => null);
    setMovendo(false);
    if (!res?.ok) { setErro("Não foi possível mover a importação."); return; }
    setMovendoAberto(false); router.refresh();
  }

  const data = new Date(lote.dataMaisRecente).toLocaleDateString("pt-BR");

  return (
    <div className="flex flex-col gap-2 border-b border-[var(--border)] py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="break-words text-sm text-[var(--text)]">
            {lote.quantidade} lançamento{lote.quantidade === 1 ? "" : "s"} · <Money centavos={lote.totalCentavos} /> · {data}
          </span>
          {lote.origemNome && <span className="text-xs text-[var(--muted)]">{lote.origemNome}</span>}
          {erro && <span className="text-xs text-[var(--negativo)]">{erro}</span>}
        </div>
        {confirmando ? (
          <div className="flex items-center gap-2">
            <Button variant="danger" onClick={apagar} disabled={excluindo}>Confirmar</Button>
            <Button variant="quiet" onClick={() => setConfirmando(false)}>Cancelar</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {cartoes.length > 0 && (
              <Button variant="ghost" onClick={() => setMovendoAberto((v) => !v)}>
                <span className="flex items-center gap-1.5"><ArrowsLeftRight size={14} /> Trocar cartão</span>
              </Button>
            )}
            <Button variant="danger" onClick={() => setConfirmando(true)}>
              <span className="flex items-center gap-1.5"><Trash size={14} /> Apagar</span>
            </Button>
          </div>
        )}
      </div>

      {movendoAberto && !confirmando && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--muted)]">Mover para</span>
          <select value={destino} onChange={(e) => setDestino(e.target.value)}
            className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text)] sm:flex-none">
            {cartoes.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.titular ? ` (${c.titular})` : ""}</option>)}
          </select>
          <Button variant="primary" onClick={mover} disabled={movendo || !destino}>{movendo ? "Movendo..." : "Mover"}</Button>
          <Button variant="quiet" onClick={() => setMovendoAberto(false)}>Cancelar</Button>
        </div>
      )}
    </div>
  );
}

export function ImportacoesRecentes({ lotes, cartoes }: { lotes: LoteImportacao[]; cartoes: CartaoOpt[] }) {
  if (lotes.length === 0) return null;
  return (
    <Card>
      <h2 className="mb-2 text-sm font-semibold text-[var(--text)]">Importações recentes</h2>
      <div className="flex flex-col">
        {lotes.map((lote) => <LinhaImportacao key={lote.grupo} lote={lote} cartoes={cartoes} />)}
      </div>
    </Card>
  );
}
