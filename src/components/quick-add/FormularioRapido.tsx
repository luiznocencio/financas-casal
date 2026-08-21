"use client";
import { useState } from "react";
import type { Card, Account, Category } from "@/lib/db/tipos";
import { reaisParaCentavos } from "@/lib/financeiro/dinheiro";
import { Button } from "@/components/ui/Button";

export function FormularioRapido({
  cartoes, contas, categorias, membros, valorInicialReais = "", onCriado,
}: {
  cartoes: Card[]; contas: Account[]; categorias: Category[]; membros: string[];
  valorInicialReais?: string; onCriado: () => void;
}) {
  const [valor, setValor] = useState(valorInicialReais);
  const [tipo, setTipo] = useState<"despesa" | "receita">("despesa");
  const [origem, setOrigem] = useState<string>(cartoes[0] ? `card:${cartoes[0].id}` : contas[0] ? `acc:${contas[0].id}` : "");
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [pessoa, setPessoa] = useState(membros[0] ?? "conjunto");
  const [parcelas, setParcelas] = useState(1);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null);
    const [prefixo, id] = origem.split(":");
    const body = {
      tipo, valor_centavos: reaisParaCentavos(valor),
      data_compra: new Date().toISOString().slice(0, 10),
      categoria_id: categoriaId || null, pessoa,
      account_id: prefixo === "acc" ? id : null,
      card_id: prefixo === "card" ? id : null,
      total_parcelas: prefixo === "card" ? parcelas : 1,
      descricao: null,
    };
    const res = await fetch("/api/transactions", { method: "POST", body: JSON.stringify(body) });
    if (!res.ok) {
      setErro("Não foi possível salvar. Tente novamente.");
      return;
    }
    onCriado();
  }

  const ehCard = origem.startsWith("card:");
  const selectStyle: React.CSSProperties = {
    padding: "9px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
    background: "var(--surface)", color: "var(--text)", fontSize: "0.9rem", minWidth: 0,
  };

  function chipStyle(ativo: boolean): React.CSSProperties {
    return {
      flex: 1, padding: "8px 12px", borderRadius: "var(--radius-sm)", fontWeight: 600, fontSize: "0.85rem",
      cursor: "pointer", border: `1px solid ${ativo ? "var(--accent)" : "var(--border)"}`,
      background: ativo ? "var(--accent-weak)" : "transparent",
      color: ativo ? "var(--accent)" : "var(--text)",
    };
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {/* valor + tipo na mesma linha */}
      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
        <input inputMode="decimal" placeholder="Valor (R$)" value={valor} autoFocus
          onChange={(e) => setValor(e.target.value)} className="mono"
          style={{
            flex: 1, minWidth: 0, fontSize: "1.5rem", fontWeight: 700, padding: "8px 12px", textAlign: "center",
            fontVariantNumeric: "tabular-nums", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)",
          }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 108 }}>
          <button onClick={() => setTipo("despesa")} aria-pressed={tipo === "despesa"} style={{ ...chipStyle(tipo === "despesa"), padding: "6px 8px" }}>Despesa</button>
          <button onClick={() => setTipo("receita")} aria-pressed={tipo === "receita"} style={{ ...chipStyle(tipo === "receita"), padding: "6px 8px" }}>Receita</button>
        </div>
      </div>

      {/* origem (+ parcelas quando cartão) */}
      <div style={{ display: "grid", gridTemplateColumns: ehCard ? "1fr 84px" : "1fr", gap: 8 }}>
        <select value={origem} onChange={(e) => setOrigem(e.target.value)} style={selectStyle}>
          {cartoes.map((c) => <option key={c.id} value={`card:${c.id}`}>💳 {c.nome}</option>)}
          {contas.map((c) => <option key={c.id} value={`acc:${c.id}`}>🏦 {c.nome}</option>)}
        </select>
        {ehCard && (
          <input type="number" min={1} max={24} value={parcelas} title="Parcelas"
            onChange={(e) => setParcelas(Number(e.target.value))} placeholder="x"
            style={{ ...selectStyle, textAlign: "center" }} />
        )}
      </div>

      {/* categoria + pessoa lado a lado */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} style={selectStyle}>
          <option value="">Sem categoria</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select value={pessoa} onChange={(e) => setPessoa(e.target.value)} style={selectStyle}>
          {membros.map((m) => <option key={m} value={m}>{m}</option>)}
          <option value="conjunto">Conjunto</option>
        </select>
      </div>

      {erro && <p style={{ color: "var(--negativo)", margin: 0, fontSize: "0.85rem" }}>{erro}</p>}
      <Button variant="primary" onClick={salvar} style={{ width: "100%" }}>Salvar</Button>
    </div>
  );
}
