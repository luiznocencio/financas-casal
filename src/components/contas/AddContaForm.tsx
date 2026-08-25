"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { reaisParaCentavos } from "@/lib/financeiro/dinheiro";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function AddContaForm() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("corrente");
  const [saldo, setSaldo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    if (!nome.trim()) { setErro("Dê um nome à conta."); return; }
    setSalvando(true);
    const res = await fetch("/api/accounts", {
      method: "POST",
      body: JSON.stringify({ nome: nome.trim(), tipo, saldo_inicial_centavos: reaisParaCentavos(saldo) }),
    });
    setSalvando(false);
    if (!res.ok) { setErro("Não foi possível criar a conta."); return; }
    setNome(""); setSaldo(""); setTipo("corrente"); setAberto(false); router.refresh();
  }

  if (!aberto) return <Button variant="ghost" onClick={() => setAberto(true)}>+ Adicionar conta</Button>;
  return (
    <div style={{ display: "grid", gap: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, background: "var(--surface)" }}>
      <Field label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Corrente Nubank" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}
            style={{ padding: "11px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}>
            <option value="corrente">Corrente</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="poupanca">Poupança</option>
          </select>
        </label>
        <Field label="Saldo inicial (R$)" inputMode="decimal" value={saldo} onChange={(e) => setSaldo(e.target.value)} placeholder="0,00" />
      </div>
      {erro && <p style={{ color: "var(--negativo)", margin: 0, fontSize: "0.85rem" }}>{erro}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="primary" onClick={salvar} disabled={salvando} style={{ flex: 1 }}>Criar conta</Button>
        <Button variant="quiet" onClick={() => setAberto(false)}>Cancelar</Button>
      </div>
    </div>
  );
}
