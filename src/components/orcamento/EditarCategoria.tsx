"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilSimple } from "@phosphor-icons/react";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CORES_CATEGORIA as CORES } from "@/lib/ui/cores";

export function EditarCategoria({
  categoriaId, nome, cor,
}: { categoriaId: string; nome: string; cor: string }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [n, setN] = useState(nome);
  const [c, setC] = useState(cor);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function salvar() {
    setErro(null);
    if (!n.trim()) { setErro("Dê um nome à categoria."); return; }
    setOcupado(true);
    const res = await fetch(`/api/categories/${categoriaId}`, {
      method: "PATCH", body: JSON.stringify({ nome: n.trim(), cor: c }),
    }).catch(() => null);
    setOcupado(false);
    if (!res?.ok) { setErro("Não consegui salvar."); return; }
    setEditando(false); router.refresh();
  }

  async function excluir() {
    setErro(null); setOcupado(true);
    const res = await fetch(`/api/categories/${categoriaId}`, { method: "DELETE" }).catch(() => null);
    setOcupado(false);
    if (!res?.ok) { setErro("Não consegui apagar."); return; }
    router.refresh();
  }

  if (!editando) {
    return (
      <Button variant="ghost" onClick={() => setEditando(true)} aria-label={`Editar categoria ${nome}`}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}><PencilSimple size={14} /> Editar</span>
      </Button>
    );
  }

  return (
    <div className="w-full" style={{ display: "grid", gap: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, background: "var(--surface-2)" }}>
      <Field label="Nome" value={n} onChange={(e) => setN(e.target.value)} />
      <div style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Cor</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {CORES.map((x) => (
            <button key={x} type="button" onClick={() => setC(x)} aria-label={`Cor ${x}`}
              style={{ width: 26, height: 26, borderRadius: 999, background: x, cursor: "pointer",
                border: c === x ? "2px solid var(--text)" : "2px solid transparent", outline: c === x ? "2px solid var(--surface)" : "none", outlineOffset: -4 }} />
          ))}
        </div>
      </div>
      {erro && <p style={{ color: "var(--negativo)", margin: 0, fontSize: "0.85rem" }}>{erro}</p>}
      {confirmando ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--negativo)]">Apagar? Lançamentos viram “Outros” e o % é perdido.</span>
          <Button variant="danger" onClick={excluir} disabled={ocupado}>Confirmar</Button>
          <Button variant="quiet" onClick={() => setConfirmando(false)}>Não</Button>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <Button variant="primary" onClick={salvar} disabled={ocupado} style={{ flex: 1 }}>Salvar</Button>
          <Button variant="quiet" onClick={() => { setEditando(false); setErro(null); setN(nome); setC(cor); }}>Cancelar</Button>
          <Button variant="danger" onClick={() => setConfirmando(true)}>Apagar</Button>
        </div>
      )}
    </div>
  );
}
