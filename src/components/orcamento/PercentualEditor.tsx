"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function PercentualEditor({ categoriaId, percentual }: { categoriaId: string; percentual: number }) {
  const router = useRouter();
  const [valor, setValor] = useState(String(percentual));
  const [salvando, setSalvando] = useState(false);

  async function salvar(novo: string) {
    const p = Math.min(100, Math.max(0, Number(novo) || 0));
    setValor(String(p));          // reflete o valor já limitado (0–100)
    if (p === percentual) return; // nada mudou → não salva à toa
    setSalvando(true);
    const res = await fetch("/api/orcamento/categoria", {
      method: "POST",
      body: JSON.stringify({ categoria_id: categoriaId, percentual: p }),
    });
    setSalvando(false);
    if (res.ok) router.refresh();
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <input type="number" min={0} max={100} value={valor} disabled={salvando}
        onChange={(e) => setValor(e.target.value)}
        onBlur={(e) => salvar(e.target.value)}
        className="mono"
        style={{ width: 56, padding: "6px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", textAlign: "right" }} />
      <span style={{ color: "var(--muted)" }}>%</span>
    </span>
  );
}
