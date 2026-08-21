"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { reaisParaCentavos, centavosParaReais } from "@/lib/financeiro/dinheiro";
import { Button } from "@/components/ui/Button";

export function RendaEditor({ rendaCentavos }: { rendaCentavos: number }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState((rendaCentavos / 100).toString());
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    const res = await fetch("/api/orcamento/renda", {
      method: "POST",
      body: JSON.stringify({ renda_mensal_centavos: reaisParaCentavos(valor) }),
    });
    setSalvando(false);
    if (res.ok) { setEditando(false); router.refresh(); }
  }

  if (!editando) {
    return (
      <button onClick={() => setEditando(true)}
        style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: "0.85rem" }}>
        {rendaCentavos > 0 ? `Renda: ${centavosParaReais(rendaCentavos)} · editar` : "Definir renda mensal"}
      </button>
    );
  }
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Renda (R$)"
        className="mono" style={{ padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", width: 140 }} />
      <Button onClick={salvar} disabled={salvando}>Salvar</Button>
    </div>
  );
}
