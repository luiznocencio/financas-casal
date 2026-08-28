"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";

export function RemoverCategoria({ categoriaId, nome }: { categoriaId: string; nome: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function apagar() {
    setErro(null); setExcluindo(true);
    const res = await fetch(`/api/categories/${categoriaId}`, { method: "DELETE" }).catch(() => null);
    setExcluindo(false);
    if (!res?.ok) { setErro("Não consegui apagar."); return; }
    router.refresh();
  }

  if (!confirmando) {
    return (
      <Button variant="quiet" onClick={() => setConfirmando(true)} aria-label={`Apagar categoria ${nome}`}>
        <Trash size={15} />
      </Button>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Button variant="danger" onClick={apagar} disabled={excluindo}>Apagar</Button>
        <Button variant="quiet" onClick={() => setConfirmando(false)}>Cancelar</Button>
      </div>
      <span className="text-xs text-[var(--muted)]">Lançamentos viram “Outros” e o % do orçamento é perdido.</span>
      {erro && <span className="text-xs text-[var(--negativo)]">{erro}</span>}
    </div>
  );
}
