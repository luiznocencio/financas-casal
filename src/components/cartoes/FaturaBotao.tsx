"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ArrowCounterClockwise } from "@phosphor-icons/react";

type Conta = { id: string; nome: string };

export function FaturaBotao({ invoiceId, paga, contas }: { invoiceId: string; paga: boolean; contas: Conta[] }) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [escolhendo, setEscolhendo] = useState(false);
  const [contaId, setContaId] = useState(contas[0]?.id ?? "");
  const [erro, setErro] = useState(false);

  async function enviar(novoPaga: boolean, accountId?: string) {
    setErro(false); setCarregando(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pagar`, {
        method: "POST", body: JSON.stringify({ paga: novoPaga, account_id: accountId ?? null }),
      });
      if (!res.ok) { setErro(true); return; }
      setEscolhendo(false); router.refresh();
    } catch { setErro(true); } finally { setCarregando(false); }
  }

  const btn = "rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-60";

  if (paga) {
    return (
      <button onClick={() => enviar(false)} disabled={carregando} className={btn}
        style={{ borderColor: erro ? "var(--negativo)" : "var(--border)", color: erro ? "var(--negativo)" : "var(--muted)" }}>
        {carregando ? "..." : <span className="flex items-center gap-1"><ArrowCounterClockwise size={13} /> Desfazer</span>}
      </button>
    );
  }
  if (escolhendo) {
    return (
      <span className="flex flex-wrap items-center justify-end gap-1">
        <select value={contaId} onChange={(e) => setContaId(e.target.value)}
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-xs text-[var(--text)]">
          {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <button onClick={() => enviar(true, contaId)} disabled={carregando || !contaId} className={btn}
          style={{ borderColor: "var(--positivo)", color: "var(--positivo)" }}>{carregando ? "..." : "Pagar"}</button>
        <button onClick={() => setEscolhendo(false)} className={btn} style={{ borderColor: "var(--border)", color: "var(--muted)" }}>✕</button>
      </span>
    );
  }
  return (
    <button onClick={() => setEscolhendo(true)} disabled={contas.length === 0} className={btn}
      style={{ borderColor: "var(--border)", color: "var(--positivo)" }}>
      <span className="flex items-center gap-1"><Check size={13} /> Marcar paga</span>
    </button>
  );
}
