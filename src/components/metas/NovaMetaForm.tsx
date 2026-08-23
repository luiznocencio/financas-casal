"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { reaisParaCentavos } from "@/lib/financeiro/dinheiro";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function NovaMetaForm() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [alvo, setAlvo] = useState("");
  const [dataAlvo, setDataAlvo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    setSalvando(true);
    const res = await fetch("/api/metas", {
      method: "POST",
      body: JSON.stringify({ nome, valor_alvo_centavos: reaisParaCentavos(alvo), data_alvo: dataAlvo || null }),
    });
    setSalvando(false);
    if (!res.ok) { setErro("Não foi possível criar a meta. Confira os dados."); return; }
    setNome(""); setAlvo(""); setDataAlvo(""); setAberto(false); router.refresh();
  }

  if (!aberto) {
    return <Button variant="ghost" onClick={() => setAberto(true)}>+ Nova meta</Button>;
  }
  return (
    <div style={{ display: "grid", gap: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, background: "var(--surface)" }}>
      <Field label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Viagem" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Valor alvo (R$)" inputMode="decimal" value={alvo} onChange={(e) => setAlvo(e.target.value)} placeholder="5.000" />
        <Field label="Data alvo (opcional)" type="date" value={dataAlvo} onChange={(e) => setDataAlvo(e.target.value)} />
      </div>
      {erro && <p style={{ color: "var(--negativo)", margin: 0, fontSize: "0.85rem" }}>{erro}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="primary" onClick={salvar} disabled={salvando} style={{ flex: 1 }}>Criar meta</Button>
        <Button variant="quiet" onClick={() => setAberto(false)}>Cancelar</Button>
      </div>
    </div>
  );
}
