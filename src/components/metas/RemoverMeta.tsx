"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function RemoverMeta({ goalId }: { goalId: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState(false);

  async function remover() {
    setErro(false);
    const res = await fetch(`/api/metas/${goalId}`, { method: "DELETE" });
    if (res.ok) { router.refresh(); return; }
    setErro(true);
  }

  if (!confirmando) {
    return (
      <Button variant="ghost" onClick={() => setConfirmando(true)}>Remover</Button>
    );
  }
  return (
    <span style={{ display: "inline-flex", gap: 8 }}>
      <Button variant="danger" onClick={remover}>
        {erro ? "Erro, tente de novo" : "Confirmar exclusão"}
      </Button>
      <Button variant="quiet" onClick={() => setConfirmando(false)}>Cancelar</Button>
    </span>
  );
}
