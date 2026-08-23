"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { reaisParaCentavos } from "@/lib/financeiro/dinheiro";
import { Button } from "@/components/ui/Button";

export function AporteForm({ goalId }: { goalId: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(false);

  async function salvar() {
    setErro(false);
    setSalvando(true);
    const res = await fetch("/api/metas/aporte", {
      method: "POST",
      body: JSON.stringify({ goal_id: goalId, valor_centavos: reaisParaCentavos(valor) }),
    });
    setSalvando(false);
    if (!res.ok) { setErro(true); return; }
    setValor(""); setAberto(false); router.refresh();
  }

  if (!aberto) {
    return <Button variant="ghost" onClick={() => setAberto(true)}>+ Aporte</Button>;
  }
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <input inputMode="decimal" autoFocus value={valor} onChange={(e) => setValor(e.target.value)} placeholder="R$"
        className="mono"
        style={{ width: 96, padding: "8px 10px", borderRadius: "var(--radius-sm)", border: `1px solid ${erro ? "var(--negativo)" : "var(--border)"}`, background: "var(--surface)", color: "var(--text)" }} />
      <Button variant="primary" onClick={salvar} disabled={salvando}>Guardar</Button>
    </span>
  );
}
