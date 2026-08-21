"use client";
import { useState } from "react";
import type { Card, Account, Category } from "@/lib/db/tipos";
import { reaisParaCentavos } from "@/lib/financeiro/dinheiro";

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

  async function salvar() {
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
    await fetch("/api/transactions", { method: "POST", body: JSON.stringify(body) });
    onCriado();
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <input inputMode="decimal" placeholder="Valor (R$)" value={valor}
        onChange={(e) => setValor(e.target.value)}
        style={{ fontSize: 32, fontWeight: 700, padding: 12, textAlign: "center" }} />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setTipo("despesa")} aria-pressed={tipo === "despesa"}>Despesa</button>
        <button onClick={() => setTipo("receita")} aria-pressed={tipo === "receita"}>Receita</button>
      </div>
      <select value={origem} onChange={(e) => setOrigem(e.target.value)}>
        {cartoes.map((c) => <option key={c.id} value={`card:${c.id}`}>💳 {c.nome}</option>)}
        {contas.map((c) => <option key={c.id} value={`acc:${c.id}`}>🏦 {c.nome}</option>)}
      </select>
      <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
        <option value="">Sem categoria</option>
        {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>
      <select value={pessoa} onChange={(e) => setPessoa(e.target.value)}>
        {membros.map((m) => <option key={m} value={m}>{m}</option>)}
        <option value="conjunto">Conjunto</option>
      </select>
      {origem.startsWith("card:") && (
        <input type="number" min={1} max={24} value={parcelas}
          onChange={(e) => setParcelas(Number(e.target.value))} placeholder="Parcelas" />
      )}
      <button onClick={salvar} style={{ padding: 12, fontWeight: 700 }}>Salvar</button>
    </div>
  );
}
