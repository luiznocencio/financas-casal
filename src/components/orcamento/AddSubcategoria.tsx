"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";

// Cria uma subcategoria pendurada nesta categoria (mesma cor por padrão).
export function AddSubcategoria({ maeId, maeCor }: { maeId: string; maeCor: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!nome.trim()) { setErro("Dê um nome."); return; }
    setErro(null); setSalvando(true);
    const res = await fetch("/api/categories", {
      method: "POST",
      body: JSON.stringify({ nome: nome.trim(), parent_id: maeId, cor: maeCor }),
    }).catch(() => null);
    setSalvando(false);
    if (!res?.ok) { setErro("Não consegui criar."); return; }
    setNome(""); setAberto(false); router.refresh();
  }

  if (!aberto) {
    return (
      <Button variant="ghost" onClick={() => setAberto(true)}>
        <span className="flex items-center gap-1"><Plus size={13} /> subcategoria</span>
      </Button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input value={nome} autoFocus onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Padaria"
        onKeyDown={(e) => { if (e.key === "Enter") salvar(); if (e.key === "Escape") setAberto(false); }}
        style={{ padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", width: 160 }} />
      <Button variant="primary" onClick={salvar} disabled={salvando}>Criar</Button>
      <Button variant="quiet" onClick={() => { setAberto(false); setErro(null); }}>Cancelar</Button>
      {erro && <span className="text-xs text-[var(--negativo)]">{erro}</span>}
    </div>
  );
}
