"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";

export function ReceitaAcoes({ id }: { id: string }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function receber() {
    setErro(null); setOcupado(true);
    const res = await fetch(`/api/receitas-agendadas/${id}/receber`, { method: "POST" }).catch(() => null);
    setOcupado(false);
    if (!res?.ok) { setErro("Falhou"); return; }
    router.refresh();
  }
  async function remover() {
    setErro(null); setOcupado(true);
    const res = await fetch(`/api/receitas-agendadas/${id}`, { method: "DELETE" }).catch(() => null);
    setOcupado(false);
    if (!res?.ok) { setErro("Falhou"); return; }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {erro && <span className="text-xs text-[var(--negativo)]">{erro}</span>}
      <Button variant="primary" onClick={receber} disabled={ocupado}>
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
