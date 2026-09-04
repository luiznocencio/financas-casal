"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { MoneyInput } from "@/components/ui/MoneyInput";

export function ReceitaAcoes({ id, valorBase }: { id: string; valorBase: number }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [recebendo, setRecebendo] = useState(false);
  const [valor, setValor] = useState(valorBase);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function receber() {
    if (!(valor > 0)) { setErro("Informe o valor recebido."); return; }
    setErro(null); setOcupado(true);
    const res = await fetch(`/api/receitas-agendadas/${id}/receber`, {
      method: "POST", body: JSON.stringify({ valor_centavos: valor }),
    }).catch(() => null);
    setOcupado(false);
    if (!res?.ok) { setErro("Falhou"); return; }
    setRecebendo(false); router.refresh();
  }
  async function remover() {
    setErro(null); setOcupado(true);
    const res = await fetch(`/api/receitas-agendadas/${id}`, { method: "DELETE" }).catch(() => null);
    setOcupado(false);
    if (!res?.ok) { setErro("Falhou"); return; }
    router.refresh();
  }

  if (recebendo) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <MoneyInput centavos={valor} onCentavos={setValor} autoFocus placeholder="Valor recebido" className="mono"
          style={{ width: 120, padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", textAlign: "right" }} />
        <Button variant="primary" onClick={receber} disabled={ocupado}>Confirmar</Button>
        <Button variant="quiet" onClick={() => { setRecebendo(false); setValor(valorBase); setErro(null); }}>Cancelar</Button>
        {erro && <span className="text-xs text-[var(--negativo)]">{erro}</span>}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {erro && <span className="text-xs text-[var(--negativo)]">{erro}</span>}
      <Button variant="primary" onClick={() => setRecebendo(true)} disabled={ocupado}>
        <span className="flex items-center gap-1.5"><Check size={14} /> Recebi</span>
      </Button>
      {confirmando ? (
        <>
          <Button variant="danger" onClick={remover} disabled={ocupado}>Apagar</Button>
          <Button variant="quiet" onClick={() => setConfirmando(false)}>Não</Button>
        </>
      ) : (
        <Button variant="quiet" onClick={() => setConfirmando(true)} aria-label="Remover receita agendada"><Trash size={15} /></Button>
      )}
    </div>
  );
}
