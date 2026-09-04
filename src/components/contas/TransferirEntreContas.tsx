"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowsLeftRight } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { MoneyInput } from "@/components/ui/MoneyInput";

type Conta = { id: string; nome: string; titular?: string | null };
const rotulo = (c: Conta) => (c.titular ? `${c.nome} · ${c.titular}` : c.nome);

export function TransferirEntreContas({ contas }: { contas: Conta[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [origem, setOrigem] = useState(contas[0]?.id ?? "");
  const [destino, setDestino] = useState(contas[1]?.id ?? "");
  const [valor, setValor] = useState(0);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (origem === destino) { setErro("Origem e destino iguais."); return; }
    if (!(valor > 0)) { setErro("Informe o valor."); return; }
    setErro(null); setSalvando(true);
    const res = await fetch("/api/transferencias", {
      method: "POST",
      body: JSON.stringify({ origem_account_id: origem, destino_account_id: destino, valor_centavos: valor, data, descricao }),
    }).catch(() => null);
    setSalvando(false);
    if (!res?.ok) {
      const j = await res?.json().catch(() => null);
      setErro(j?.error ?? "Não consegui transferir."); return;
    }
    setValor(0); setDescricao(""); setAberto(false); router.refresh();
  }

  if (contas.length < 2) return null;

  if (!aberto) {
    return (
      <Button variant="ghost" onClick={() => setAberto(true)}>
        <span className="flex items-center gap-1.5"><ArrowsLeftRight size={16} /> Transferir entre contas</span>
      </Button>
    );
  }

  const selectStyle: React.CSSProperties = {
    width: "100%", minWidth: 0, boxSizing: "border-box", padding: "11px 12px", borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "1rem",
  };

  return (
    <div style={{ display: "grid", gap: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, background: "var(--surface)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>De</span>
          <select value={origem} onChange={(e) => setOrigem(e.target.value)} style={selectStyle}>
            {contas.map((c) => <option key={c.id} value={c.id}>{rotulo(c)}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Para</span>
          <select value={destino} onChange={(e) => setDestino(e.target.value)} style={selectStyle}>
            {contas.map((c) => <option key={c.id} value={c.id}>{rotulo(c)}</option>)}
          </select>
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 148px", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Valor</span>
          <MoneyInput centavos={valor} onCentavos={setValor} placeholder="R$" style={selectStyle} className="mono" />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Data</span>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={selectStyle} />
        </label>
      </div>
      <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição (opcional)" style={selectStyle} />
      {erro && <p style={{ color: "var(--negativo)", margin: 0, fontSize: "0.85rem" }}>{erro}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="primary" onClick={salvar} disabled={salvando} style={{ flex: 1 }}>Transferir</Button>
        <Button variant="quiet" onClick={() => { setAberto(false); setErro(null); }}>Cancelar</Button>
      </div>
    </div>
  );
}
