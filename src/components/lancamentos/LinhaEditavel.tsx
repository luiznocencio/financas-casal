"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilSimple, Trash } from "@phosphor-icons/react";
import { Money } from "@/components/ui/Money";
import { PersonChip } from "@/components/ui/PersonChip";
import { CategoriaTag } from "@/components/ui/CategoriaTag";
import { Button } from "@/components/ui/Button";

type Tx = {
  id: string; descricao: string | null; data_compra: string; pessoa: string;
  parcela_n: number; total_parcelas: number; tipo: string; valor_centavos: number;
  categoria_id: string | null; card_id: string | null; account_id: string | null;
  recorrente_id: string | null;
};

export function LinhaEditavel({
  tx, categorias, membros, cartoes,
}: { tx: Tx; categorias: { id: string; nome: string; cor: string }[]; membros: string[]; cartoes: { id: string; nome: string }[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [descricao, setDescricao] = useState(tx.descricao ?? "");
  const [categoriaId, setCategoriaId] = useState(tx.categoria_id ?? "");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

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

  async function excluir() {
    setExcluindo(true);
    const res = await fetch(`/api/transactions/${tx.id}`, { method: "DELETE" }).catch(() => null);
    setExcluindo(false);
    if (!res?.ok) { setAviso("Não foi possível apagar o lançamento."); return; }
    router.refresh();
  }

  const valorSinal = tx.tipo === "receita" ? tx.valor_centavos : -tx.valor_centavos;
  const cat = categorias.find((c) => c.id === tx.categoria_id);
  const cartaoNome = tx.card_id ? cartoes.find((c) => c.id === tx.card_id)?.nome ?? "Cartão" : null;
  // origem: cartão (mostra o nome) ou conta (mostra "Pix")
  const origemLabel = cartaoNome ?? (tx.account_id ? "Pix" : null);

  if (!editando) {
    return (
      <li className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-3 last:border-b-0">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="break-words text-[var(--text)]">{tx.descricao ?? "(sem descrição)"}</span>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <span>{tx.data_compra}</span>
            <PersonChip nome={tx.pessoa} membros={membros} />
            {cat && <CategoriaTag nome={cat.nome} cor={cat.cor} tamanho="sm" />}
            {origemLabel && (
              <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[0.7rem] font-medium text-[var(--text)]">
                {origemLabel}
              </span>
            )}
            {tx.recorrente_id && (
              <span className="rounded-full px-2 py-0.5 text-[0.7rem] font-medium"
                style={{ background: "var(--accent-weak)", color: "var(--accent)" }}>
                Fixo
              </span>
            )}
            {tx.total_parcelas > 1 && <span>{tx.parcela_n}/{tx.total_parcelas}</span>}
          </div>
          {aviso && <p className="text-xs text-[var(--negativo)]">{aviso}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Money centavos={valorSinal} sinal />
          {confirmandoExclusao ? (
            <>
              <Button variant="danger" tamanho="md" onClick={excluir} disabled={excluindo}
                style={{ padding: "9px 12px", fontSize: "0.75rem" }}>
                Confirmar
              </Button>
              <Button variant="quiet" tamanho="md" onClick={() => setConfirmandoExclusao(false)}
                style={{ padding: "9px 12px", fontSize: "0.75rem" }}>
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" tamanho="md" onClick={() => setEditando(true)}
                style={{ padding: "10px 10px" }} aria-label="Editar lançamento">
                <PencilSimple size={13} />
              </Button>
              <Button variant="danger" tamanho="md" onClick={() => setConfirmandoExclusao(true)}
                style={{ padding: "10px 10px" }} aria-label="Apagar lançamento">
                <Trash size={13} />
              </Button>
            </>
          )}
        </div>
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
