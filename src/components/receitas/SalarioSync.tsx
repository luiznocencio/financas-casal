"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CurrencyCircleDollar } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";

// Puxa/atualiza o salário fixo do orçamento como receita mensal em "A receber".
export function SalarioSync({ jaTem }: { jaTem: boolean }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function sincronizar() {
    setErro(null); setMsg(null); setOcupado(true);
    const res = await fetch("/api/receitas-agendadas/salarios", { method: "POST" }).catch(() => null);
    setOcupado(false);
    if (!res?.ok) {
      const j = await res?.json().catch(() => null);
      setErro(j?.error ?? "Não consegui puxar o salário."); return;
    }
    const j = await res.json();
    const partes: string[] = [];
    if (j.criados) partes.push(`${j.criados} criado(s)`);
    if (j.atualizados) partes.push(`${j.atualizados} atualizado(s)`);
    setMsg(partes.length ? partes.join(" · ") : "Nada a fazer — defina a renda no Orçamento.");
    if (j.semConta?.length) setErro(`Sem conta pra: ${j.semConta.join(", ")}`);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="ghost" onClick={sincronizar} disabled={ocupado}>
        <span className="flex items-center gap-1.5">
          <CurrencyCircleDollar size={16} />
          {ocupado ? "Puxando…" : jaTem ? "Atualizar salário do orçamento" : "Puxar salário do orçamento"}
        </span>
      </Button>
      {msg && <span className="text-xs text-[var(--positivo)]">{msg}</span>}
      {erro && <span className="text-xs text-[var(--negativo)]">{erro}</span>}
    </div>
  );
}
