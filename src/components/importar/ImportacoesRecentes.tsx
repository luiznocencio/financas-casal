"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash } from "@phosphor-icons/react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";

export type LoteImportacao = {
  grupo: string;
  quantidade: number;
  totalCentavos: number;
  dataMaisRecente: string;
};

function LinhaImportacao({ lote }: { lote: LoteImportacao }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function apagar() {
    setErro(null);
    setExcluindo(true);
    const res = await fetch(`/api/importar/${lote.grupo}`, { method: "DELETE" }).catch(() => null);
    setExcluindo(false);
    if (!res?.ok) { setErro("Não foi possível apagar a importação."); return; }
    router.refresh();
  }

  const data = new Date(lote.dataMaisRecente).toLocaleDateString("pt-BR");

  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-3 last:border-b-0">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm text-[var(--text)]">
          {lote.quantidade} lançamento{lote.quantidade === 1 ? "" : "s"} · <Money centavos={lote.totalCentavos} /> · {data}
        </span>
        {erro && <span className="text-xs text-[var(--negativo)]">{erro}</span>}
      </div>
      {confirmando ? (
        <div className="flex items-center gap-2">
          <Button variant="danger" onClick={apagar} disabled={excluindo}>Confirmar</Button>
          <Button variant="quiet" onClick={() => setConfirmando(false)}>Cancelar</Button>
        </div>
      ) : (
        <Button variant="danger" onClick={() => setConfirmando(true)}>
          <span className="flex items-center gap-1.5"><Trash size={14} /> Apagar importação</span>
        </Button>
      )}
    </div>
  );
}

export function ImportacoesRecentes({ lotes }: { lotes: LoteImportacao[] }) {
  if (lotes.length === 0) return null;
  return (
    <Card>
      <h2 className="mb-2 text-sm font-semibold text-[var(--text)]">Importações recentes</h2>
      <div className="flex flex-col">
        {lotes.map((lote) => <LinhaImportacao key={lote.grupo} lote={lote} />)}
      </div>
    </Card>
  );
}
