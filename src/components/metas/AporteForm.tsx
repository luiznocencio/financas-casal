"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { MoneyInput } from "@/components/ui/MoneyInput";

type Conta = { id: string; nome: string; titular?: string | null };
const rotulo = (c: Conta) => (c.titular ? `${c.nome} · ${c.titular}` : c.nome);

export function AporteForm({ goalId, contas }: { goalId: string; contas: Conta[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState(0);
  const [contaId, setContaId] = useState(contas[0]?.id ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(false);

  async function salvar() {
    if (!(valor > 0)) { setErro(true); return; }
    setErro(false);
    setSalvando(true);
    const res = await fetch("/api/metas/aporte", {
      method: "POST",
      body: JSON.stringify({ goal_id: goalId, valor_centavos: valor, account_id: contaId || null }),
    });
    setSalvando(false);
    if (!res.ok) { setErro(true); return; }
    setValor(0); setAberto(false); router.refresh();
  }

  if (!aberto) {
    return <Button variant="ghost" onClick={() => setAberto(true)}>+ Aporte</Button>;
  }
  const campo: React.CSSProperties = {
    padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
    background: "var(--surface)", color: "var(--text)",
  };
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      <MoneyInput centavos={valor} onCentavos={setValor} autoFocus placeholder="R$" className="mono"
        style={{ ...campo, width: 96, borderColor: erro ? "var(--negativo)" : "var(--border)" }} />
      {contas.length > 0 && (
        <select value={contaId} onChange={(e) => setContaId(e.target.value)} style={{ ...campo, fontSize: "0.85rem" }}
          title="De qual conta sai o dinheiro guardado">
          {contas.map((c) => <option key={c.id} value={c.id}>{rotulo(c)}</option>)}
          <option value="">não debitar</option>
        </select>
      )}
      <Button variant="primary" onClick={salvar} disabled={salvando}>Guardar</Button>
    </span>
  );
}
