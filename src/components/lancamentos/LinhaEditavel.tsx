"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilSimple } from "@phosphor-icons/react";
import { Money } from "@/components/ui/Money";
import { PersonChip } from "@/components/ui/PersonChip";
import { Button } from "@/components/ui/Button";

type Tx = {
  id: string; descricao: string | null; data_compra: string; pessoa: string;
  parcela_n: number; total_parcelas: number; tipo: string; valor_centavos: number;
  categoria_id: string | null;
};

export function LinhaEditavel({
  tx, categorias, membros,
}: { tx: Tx; categorias: { id: string; nome: string }[]; membros: string[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [descricao, setDescricao] = useState(tx.descricao ?? "");
  const [categoriaId, setCategoriaId] = useState(tx.categoria_id ?? "");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true);
    const res = await fetch(`/api/transactions/${tx.id}`, {
      method: "PATCH",
      body: JSON.stringify({ descricao: descricao || null, categoria_id: categoriaId || null }),
    }).then((x) => x.json()).catch(() => null);
    setSalvando(false);
    if (!res?.ok) { setAviso("Não foi possível salvar."); return; }
    setEditando(false);
    router.refresh();
  }

  const valorSinal = tx.tipo === "receita" ? tx.valor_centavos : -tx.valor_centavos;

  if (!editando) {
    return (
      <li className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-3 last:border-b-0">
        <div className="flex min-w-0 flex-col gap-1">
          <button onClick={() => setEditando(true)} className="flex items-center gap-1.5 text-left text-[var(--text)]">
            {tx.descricao ?? "(sem descrição)"} <PencilSimple size={13} className="text-[var(--muted)]" />
          </button>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <span>{tx.data_compra}</span>
            <PersonChip nome={tx.pessoa} membros={membros} />
            {tx.total_parcelas > 1 && <span>{tx.parcela_n}/{tx.total_parcelas}</span>}
          </div>
        </div>
        <Money centavos={valorSinal} sinal />
      </li>
    );
  }
  return (
    <li className="flex flex-col gap-2 border-b border-[var(--border)] py-3 last:border-b-0">
      <input value={descricao} onChange={(e) => setDescricao(e.target.value)}
        className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[var(--text)]" />
      <div className="flex items-center gap-2">
        <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}
          className="flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[var(--text)]">
          <option value="">Sem categoria</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <Button variant="primary" onClick={salvar} disabled={salvando}>Salvar</Button>
        <Button variant="quiet" onClick={() => setEditando(false)}>Cancelar</Button>
      </div>
      {aviso && <p className="text-sm text-[var(--negativo)]">{aviso}</p>}
    </li>
  );
}
