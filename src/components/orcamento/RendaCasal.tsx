"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { reaisParaCentavos, centavosParaReais } from "@/lib/financeiro/dinheiro";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";

export type MembroRenda = { user_id: string; nome: string; renda_mensal_centavos: number };

function LinhaMembro({ membro }: { membro: MembroRenda }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState((membro.renda_mensal_centavos / 100).toString());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setErro(null); setSalvando(true);
    const res = await fetch("/api/orcamento/renda", {
      method: "POST",
      body: JSON.stringify({ user_id: membro.user_id, renda_mensal_centavos: reaisParaCentavos(valor) }),
    }).catch(() => null);
    setSalvando(false);
    if (res?.ok) { setEditando(false); router.refresh(); }
    else setErro("Não consegui salvar. Tente de novo.");
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2">
      <span className="min-w-0 break-words text-sm text-[var(--text)]">{membro.nome}</span>
      {editando ? (
        <div className="flex items-center gap-2">
          <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="R$"
            className="mono" style={{ padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", width: 130 }} />
          <Button onClick={salvar} disabled={salvando}>Salvar</Button>
          <Button variant="quiet" onClick={() => { setEditando(false); setErro(null); }}>Cancelar</Button>
          {erro && <span className="text-xs text-[var(--negativo)]">{erro}</span>}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Money centavos={membro.renda_mensal_centavos} />
          <Button variant="ghost" onClick={() => setEditando(true)}>editar</Button>
        </div>
      )}
    </div>
  );
}

export function RendaCasal({ membros }: { membros: MembroRenda[] }) {
  const total = membros.reduce((s, m) => s + m.renda_mensal_centavos, 0);
  return (
    <Card>
      <h2 className="mb-1 text-sm font-semibold text-[var(--text)]">Renda do casal</h2>
      <p className="mb-2 text-xs text-[var(--muted)]">Cada um informa a sua; o orçamento usa a soma.</p>
      <div className="flex flex-col divide-y divide-[var(--border)]">
        {membros.map((m) => <LinhaMembro key={m.user_id} membro={m} />)}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-3">
        <span className="text-sm font-medium text-[var(--text)]">Total</span>
        <Money centavos={total} tamanho="lg" />
      </div>
    </Card>
  );
}
