"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ArrowCounterClockwise } from "@phosphor-icons/react";

export function FaturaBotao({ invoiceId, paga }: { invoiceId: string; paga: boolean }) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);

  async function alternar() {
    setErro(false);
    setCarregando(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pagar`, {
        method: "POST",
        body: JSON.stringify({ paga: !paga }),
      });
      if (!res.ok) {
        setErro(true);
        return;
      }
      router.refresh();
    } catch {
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <button
      onClick={alternar}
      disabled={carregando}
      className="rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-60"
      style={{
        borderColor: erro ? "var(--negativo)" : "var(--borda)",
        color: erro ? "var(--negativo)" : paga ? "var(--muted)" : "var(--positivo)",
      }}
    >
      {carregando ? (
        "..."
      ) : erro ? (
        "Tente de novo"
      ) : paga ? (
        <span className="flex items-center gap-1"><ArrowCounterClockwise size={13} /> Desfazer</span>
      ) : (
        <span className="flex items-center gap-1"><Check size={13} /> Marcar paga</span>
      )}
    </button>
  );
}
