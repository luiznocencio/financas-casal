"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilSimple } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";

export function EditarMeta({ goalId, nome }: { goalId: string; nome: string }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [n, setN] = useState(nome);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!n.trim()) { setErro("Dê um nome."); return; }
    setErro(null); setSalvando(true);
    const res = await fetch(`/api/metas/${goalId}`, {
      method: "PATCH", body: JSON.stringify({ nome: n.trim() }),
    }).catch(() => null);
    setSalvando(false);
    if (!res?.ok) { setErro("Não consegui salvar."); return; }
    setEditando(false); router.refresh();
  }

  if (!editando) {
    return (
      <Button variant="quiet" onClick={() => setEditando(true)} aria-label="Renomear meta">
        <PencilSimple size={15} />
      </Button>
    );
  }
  return (
    <div className="flex w-full flex-col gap-1">
      <div className="flex items-center gap-2">
        <input value={n} onChange={(e) => setN(e.target.value)} autoFocus
          className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[var(--text)]" />
        <Button variant="primary" onClick={salvar} disabled={salvando}>Salvar</Button>
        <Button variant="quiet" onClick={() => { setEditando(false); setN(nome); setErro(null); }}>Cancelar</Button>
      </div>
      {erro && <span className="text-xs text-[var(--negativo)]">{erro}</span>}
    </div>
  );
}
