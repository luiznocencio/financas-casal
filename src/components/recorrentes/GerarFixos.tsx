"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

export function GerarFixos({ pendentes }: { pendentes: number }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function gerar() {
    setMsg(null); setOcupado(true);
    const r = await fetch("/api/recorrentes/gerar", { method: "POST" }).then((x) => x.json()).catch(() => null);
    setOcupado(false);
    if (!r?.criadas && r?.criadas !== 0) { setMsg("Não consegui lançar agora."); return; }
    setMsg(`${r.criadas} lançamento${r.criadas === 1 ? "" : "s"} de fixos gerado${r.criadas === 1 ? "" : "s"} neste mês.`);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary" onClick={gerar} disabled={ocupado}>
        <span className="flex items-center gap-2">
          {ocupado && <Spinner size={14} />}
          {ocupado ? "Lançando..." : pendentes > 0 ? `Lançar ${pendentes} fixo${pendentes === 1 ? "" : "s"} deste mês` : "Lançar fixos deste mês"}
        </span>
      </Button>
      {msg && <span className="text-sm text-[var(--positivo)]">{msg}</span>}
    </div>
  );
}
