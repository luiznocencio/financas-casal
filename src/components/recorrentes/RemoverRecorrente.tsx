"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";

export function RemoverRecorrente({ id }: { id: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  async function apagar() {
    setExcluindo(true);
    const res = await fetch(`/api/recorrentes/${id}`, { method: "DELETE" }).catch(() => null);
    setExcluindo(false);
    if (res?.ok) router.refresh();
  }

  if (!confirmando) {
    return (
      <Button variant="quiet" onClick={() => setConfirmando(true)} aria-label="Apagar gasto fixo">
        <Trash size={15} />
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Button variant="danger" onClick={apagar} disabled={excluindo}>Apagar</Button>
      <Button variant="quiet" onClick={() => setConfirmando(false)}>Não</Button>
    </div>
  );
}
