"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CORES_CATEGORIA as CORES } from "@/lib/ui/cores";

export function AddCategoriaForm({ maes = [] }: { maes?: { id: string; nome: string }[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("despesa");
  const [parentId, setParentId] = useState("");
  const [cor, setCor] = useState(CORES[0]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    if (!nome.trim()) { setErro("Dê um nome à categoria."); return; }
    setSalvando(true);
    const res = await fetch("/api/categories", {
      method: "POST",
      body: JSON.stringify({ nome: nome.trim(), tipo, cor, parent_id: parentId || null }),
    });
    setSalvando(false);
    if (!res.ok) { setErro("Não foi possível criar a categoria."); return; }
    setNome(""); setTipo("despesa"); setParentId(""); setCor(CORES[0]); setAberto(false); router.refresh();
  }

  if (!aberto) return <Button variant="ghost" onClick={() => setAberto(true)}>+ Nova categoria</Button>;
  return (
    <div style={{ display: "grid", gap: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, background: "var(--surface)" }}>
      <Field label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Padaria" />
      {maes.length > 0 && (
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Subcategoria de (opcional)</span>
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}
            style={{ padding: "11px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}>
            <option value="">— categoria principal —</option>
            {maes.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </label>
      )}
      {!parentId && (
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}
            style={{ padding: "11px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}>
            <option value="despesa">Despesa</option>
            <option value="receita">Receita</option>
          </select>
        </label>
      )}
      <div style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Cor</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {CORES.map((c) => (
            <button key={c} type="button" onClick={() => setCor(c)} aria-label={`Cor ${c}`}
              style={{
                width: 26, height: 26, borderRadius: 999, background: c, cursor: "pointer",
                border: cor === c ? "2px solid var(--text)" : "2px solid transparent",
                outline: cor === c ? "2px solid var(--surface)" : "none", outlineOffset: -4,
              }} />
          ))}
        </div>
      </div>
      {erro && <p style={{ color: "var(--negativo)", margin: 0, fontSize: "0.85rem" }}>{erro}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="primary" onClick={salvar} disabled={salvando} style={{ flex: 1 }}>Criar categoria</Button>
        <Button variant="quiet" onClick={() => setAberto(false)}>Cancelar</Button>
      </div>
    </div>
  );
}
