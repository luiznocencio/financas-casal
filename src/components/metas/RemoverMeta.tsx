"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function RemoverMeta({ goalId }: { goalId: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);

  async function remover() {
    const res = await fetch(`/api/metas/${goalId}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  if (!confirmando) {
    return (
      <button onClick={() => setConfirmando(true)}
        style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "0.8rem" }}>
        remover
      </button>
    );
  }
  return (
    <span style={{ display: "inline-flex", gap: 8, fontSize: "0.8rem" }}>
      <button onClick={remover} style={{ background: "none", border: "none", color: "var(--negativo)", cursor: "pointer" }}>confirmar</button>
      <button onClick={() => setConfirmando(false)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}>cancelar</button>
    </span>
  );
}
