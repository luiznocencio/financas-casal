"use client";

import { useEffect, useState } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { fraseFixa, type FatosResumo } from "@/lib/financeiro/resumoFrase";

// Resumo do mês em uma frase. Mostra na hora a frase montada pelo app e troca
// pela versão redigida pela IA quando ela chega (mesmos números).
export function ResumoFrase({ mes, fatos }: { mes: string; fatos: FatosResumo }) {
  const chave = JSON.stringify(fatos);
  const [texto, setTexto] = useState(() => fraseFixa(fatos));

  useEffect(() => {
    // (a Home monta com key por mês, então a frase fixa inicial já é a do mês certo)
    const f = JSON.parse(chave) as FatosResumo;
    let vivo = true;
    fetch("/api/resumo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mes, fatos: f }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (vivo && j?.texto) setTexto(j.texto); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [mes, chave]);

  return (
    <p className="flex items-start gap-2 text-sm leading-relaxed text-[var(--text)]">
      <Sparkle size={16} weight="fill" className="mt-0.5 shrink-0 text-[var(--accent)]" aria-hidden />
      <span>{texto}</span>
    </p>
  );
}
