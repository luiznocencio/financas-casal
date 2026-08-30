"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { MoneyInput } from "@/components/ui/MoneyInput";

export function ContaPagarAcoes({
  id, valorEstimado, jaPaga, contas,
}: { id: string; valorEstimado: number; jaPaga: boolean; contas: { id: string; nome: string; titular?: string | null }[] }) {
  const rotuloConta = (c: { nome: string; titular?: string | null }) => c.titular ? `${c.nome} · ${c.titular}` : c.nome;
  const router = useRouter();
  const [pagando, setPagando] = useState(false);
  const [valor, setValor] = useState(valorEstimado);
  const [contaId, setContaId] = useState(contas[0]?.id ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function pagar() {
    if (!(valor > 0)) { setErro("Informe o valor pago."); return; }
    if (!contaId) { setErro("Escolha a conta."); return; }
    setErro(null); setOcupado(true);
    const res = await fetch(`/api/contas-pagar/${id}/pagar`, {
      method: "POST", body: JSON.stringify({ valor_centavos: valor, account_id: contaId }),
    }).catch(() => null);
    setOcupado(false);
    if (!res?.ok) { setErro("Falhou"); return; }
    setPagando(false); router.refresh();
  }
  async function remover() {
    setOcupado(true);
    const res = await fetch(`/api/contas-pagar/${id}`, { method: "DELETE" }).catch(() => null);
    setOcupado(false);
    if (res?.ok) router.refresh();
  }

  if (pagando) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <MoneyInput centavos={valor} onCentavos={setValor} autoFocus placeholder="Valor pago" className="mono"
          style={{ width: 110, padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", textAlign: "right" }} />
        <select value={contaId} onChange={(e) => setContaId(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text)]">
          {contas.map((c) => <option key={c.id} value={c.id}>{rotuloConta(c)}</option>)}
        </select>
        <Button variant="primary" onClick={pagar} disabled={ocupado}>Confirmar</Button>
        <Button variant="quiet" onClick={() => setPagando(false)}>Cancelar</Button>
        {erro && <span className="text-xs text-[var(--negativo)]">{erro}</span>}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {!jaPaga && (
        <Button variant="primary" onClick={() => setPagando(true)}>
          <span className="flex items-center gap-1.5"><Check size={14} /> Pagar</span>
        </Button>
      )}
      {confirmando ? (
        <>
          <Button variant="danger" onClick={remover} disabled={ocupado}>Apagar</Button>
          <Button variant="quiet" onClick={() => setConfirmando(false)}>Não</Button>
        </>
      ) : (
        <Button variant="quiet" onClick={() => setConfirmando(true)} aria-label="Remover conta a pagar"><Trash size={15} /></Button>
      )}
    </div>
  );
}
