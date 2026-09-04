"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { centavosParaReais } from "@/lib/financeiro/dinheiro";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { MoneyInput } from "@/components/ui/MoneyInput";

export type ContaOpt = { id: string; nome: string; titular?: string | null };
export type MembroRenda = {
  user_id: string; nome: string;
  renda_mensal_centavos: number; ajuda_custo_centavos: number;
  salario_account_id: string | null; ajuda_custo_account_id: string | null;
};

const rotuloConta = (c: ContaOpt) => (c.titular ? `${c.nome} · ${c.titular}` : c.nome);

function LinhaMembro({ membro, contas }: { membro: MembroRenda; contas: ContaOpt[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [salario, setSalario] = useState(membro.renda_mensal_centavos);
  const [ajuda, setAjuda] = useState(membro.ajuda_custo_centavos);
  const [contaSalario, setContaSalario] = useState(membro.salario_account_id ?? "");
  const [contaAjuda, setContaAjuda] = useState(membro.ajuda_custo_account_id ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const total = membro.renda_mensal_centavos + membro.ajuda_custo_centavos;

  async function salvar() {
    setErro(null); setSalvando(true);
    const res = await fetch("/api/orcamento/renda", {
      method: "POST",
      body: JSON.stringify({
        user_id: membro.user_id,
        renda_mensal_centavos: salario,
        ajuda_custo_centavos: ajuda,
        salario_account_id: contaSalario || null,
        ajuda_custo_account_id: contaAjuda || null,
      }),
    }).catch(() => null);
    setSalvando(false);
    if (res?.ok) { setEditando(false); router.refresh(); }
    else setErro("Não consegui salvar. Tente de novo.");
  }

  const inputStyle: React.CSSProperties = {
    padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
    background: "var(--surface)", color: "var(--text)", width: 110,
  };
  const selectStyle: React.CSSProperties = { ...inputStyle, width: "auto", flex: 1, minWidth: 120 };

  if (!editando) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 py-2">
        <div className="flex min-w-0 flex-col">
          <span className="break-words text-sm text-[var(--text)]">{membro.nome}</span>
          <span className="text-xs text-[var(--muted)]">
            salário {centavosParaReais(membro.renda_mensal_centavos)} + ajuda {centavosParaReais(membro.ajuda_custo_centavos)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Money centavos={total} />
          <Button variant="ghost" onClick={() => setEditando(true)}>editar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 py-3">
      <span className="text-sm font-medium text-[var(--text)]">{membro.nome}</span>
      <div className="flex flex-wrap items-center gap-2">
        <MoneyInput centavos={salario} onCentavos={setSalario} placeholder="Salário R$" className="mono" style={inputStyle} />
        <span className="text-xs text-[var(--muted)]">cai na</span>
        <select value={contaSalario} onChange={(e) => setContaSalario(e.target.value)} style={selectStyle}>
          <option value="">conta do titular</option>
          {contas.map((c) => <option key={c.id} value={c.id}>{rotuloConta(c)}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <MoneyInput centavos={ajuda} onCentavos={setAjuda} placeholder="Ajuda de custo R$" className="mono" style={inputStyle} />
        <span className="text-xs text-[var(--muted)]">cai na</span>
        <select value={contaAjuda} onChange={(e) => setContaAjuda(e.target.value)} style={selectStyle}>
          <option value="">conta do titular</option>
          {contas.map((c) => <option key={c.id} value={c.id}>{rotuloConta(c)}</option>)}
        </select>
      </div>
      {erro && <span className="text-xs text-[var(--negativo)]">{erro}</span>}
      <div className="flex gap-2">
        <Button onClick={salvar} disabled={salvando}>Salvar</Button>
        <Button variant="quiet" onClick={() => { setEditando(false); setErro(null); }}>Cancelar</Button>
      </div>
    </div>
  );
}

export function RendaCasal({ membros, contas }: { membros: MembroRenda[]; contas: ContaOpt[] }) {
  const total = membros.reduce((s, m) => s + m.renda_mensal_centavos + m.ajuda_custo_centavos, 0);
  return (
    <Card>
      <h2 className="mb-1 text-sm font-semibold text-[var(--text)]">Renda do casal</h2>
      <p className="mb-2 text-xs text-[var(--muted)]">Salário + ajuda de custo de cada um (podem cair em contas diferentes). O orçamento usa a soma.</p>
      <div className="flex flex-col divide-y divide-[var(--border)]">
        {membros.map((m) => <LinhaMembro key={m.user_id} membro={m} contas={contas} />)}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-3">
        <span className="text-sm font-medium text-[var(--text)]">Total</span>
        <Money centavos={total} tamanho="lg" />
      </div>
    </Card>
  );
}
