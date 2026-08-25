"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

const CORES = ["#2f9e44", "#e8590c", "#1971c2", "#6741d9", "#c2255c", "#f08c00", "#9c36b5", "#2b8a3e"];

export function AddCategoriaForm() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("despesa");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    if (!nome.trim()) { setErro("Dê um nome à categoria."); return; }
    setSalvando(true);
    const cor = CORES[Math.floor(Math.random() * CORES.length)];
    const res = await fetch("/api/categories", {
      method: "POST",
      body: JSON.stringify({ nome: nome.trim(), tipo, cor }),
    });
    setSalvando(false);
    if (!res.ok) { setErro("Não foi possível criar a categoria."); return; }
    setNome(""); setTipo("despesa"); setAberto(false); router.refresh();
  }

  if (!aberto) return <Button variant="ghost" onClick={() => setAberto(true)}>+ Nova categoria</Button>;
  return (
    <div style={{ display: "grid", gap: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, background: "var(--surface)" }}>
      <Field label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Pets" />
      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Tipo</span>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}
          style={{ padding: "11px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}>
          <option value="despesa">Despesa</option>
          <option value="receita">Receita</option>
        </select>
      </label>
      {erro && <p style={{ color: "var(--negativo)", margin: 0, fontSize: "0.85rem" }}>{erro}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="primary" onClick={salvar} disabled={salvando} style={{ flex: 1 }}>Criar categoria</Button>
        <Button variant="quiet" onClick={() => setAberto(false)}>Cancelar</Button>
      </div>
    </div>
  );
}
