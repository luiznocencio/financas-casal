"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoneyInput } from "@/components/ui/MoneyInput";

// Editor do limite da categoria em REAIS (máscara centavos-primeiro).
export function PercentualEditor({ categoriaId, valorCentavos }: { categoriaId: string; valorCentavos: number }) {
  const router = useRouter();
  const [valor, setValor] = useState(valorCentavos);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (valor === valorCentavos) return; // nada mudou
    setSalvando(true);
    const res = await fetch("/api/orcamento/categoria", {
      method: "POST",
      body: JSON.stringify({ categoria_id: categoriaId, valor_centavos: valor }),
    });
    setSalvando(false);
    if (res.ok) router.refresh();
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ color: "var(--muted)" }}>R$</span>
      <MoneyInput centavos={valor} onCentavos={setValor} placeholder="0,00" className="mono"
        style={{ width: 96, padding: "6px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", textAlign: "right", opacity: salvando ? 0.6 : 1 }} />
      <button onClick={salvar} disabled={salvando || valor === valorCentavos}
        style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--surface)", color: "var(--accent)", padding: "6px 8px", cursor: "pointer", fontSize: "0.8rem" }}>ok</button>
    </span>
  );
}
