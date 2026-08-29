"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { reaisParaCentavos } from "@/lib/financeiro/dinheiro";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { TitularSelect } from "@/components/ui/TitularSelect";

export function AddCartaoForm({ membros }: { membros: string[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [limite, setLimite] = useState("");
  const [fechamento, setFechamento] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [titular, setTitular] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    const f = Number(fechamento), v = Number(vencimento);
    if (!nome.trim() || !(f >= 1 && f <= 31) || !(v >= 1 && v <= 31)) {
      setErro("Preencha nome e dias de fechamento/vencimento (1 a 31)."); return;
    }
    setSalvando(true);
    const res = await fetch("/api/cards", {
      method: "POST",
      body: JSON.stringify({
        nome: nome.trim(), limite_centavos: reaisParaCentavos(limite),
        dia_fechamento: f, dia_vencimento: v, titular: titular.trim() || null,
      }),
    });
    setSalvando(false);
    if (!res.ok) { setErro("Não foi possível criar o cartão."); return; }
    setNome(""); setLimite(""); setFechamento(""); setVencimento(""); setTitular(""); setAberto(false); router.refresh();
  }

  if (!aberto) return <Button variant="ghost" onClick={() => setAberto(true)}>+ Adicionar cartão</Button>;
  return (
    <div style={{ display: "grid", gap: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, background: "var(--surface)" }}>
      <Field label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Nubank" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Limite (R$)" inputMode="decimal" value={limite} onChange={(e) => setLimite(e.target.value)} placeholder="5.000" />
        <TitularSelect value={titular} onChange={setTitular} membros={membros} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Dia de fechamento" type="number" value={fechamento} onChange={(e) => setFechamento(e.target.value)} placeholder="10" />
        <Field label="Dia de vencimento" type="number" value={vencimento} onChange={(e) => setVencimento(e.target.value)} placeholder="17" />
      </div>
      {erro && <p style={{ color: "var(--negativo)", margin: 0, fontSize: "0.85rem" }}>{erro}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="primary" onClick={salvar} disabled={salvando} style={{ flex: 1 }}>Criar cartão</Button>
        <Button variant="quiet" onClick={() => setAberto(false)}>Cancelar</Button>
      </div>
    </div>
  );
}
