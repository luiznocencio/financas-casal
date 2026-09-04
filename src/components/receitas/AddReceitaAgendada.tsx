"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoneyField } from "@/components/ui/MoneyField";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

type Conta = { id: string; nome: string; titular?: string | null };

export function AddReceitaAgendada({ contas, membros }: { contas: Conta[]; membros: string[] }) {
  const router = useRouter();
  const hoje = new Date().toISOString().slice(0, 10);

  const [aberto, setAberto] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState(0);
  const [accountId, setAccountId] = useState(contas[0]?.id ?? "");
  const [data, setData] = useState(hoje);
  const [recorrencia, setRecorrencia] = useState<"unica" | "mensal">("unica");
  const [dataFim, setDataFim] = useState("");
  const [pessoa, setPessoa] = useState(membros[0] ?? "conjunto");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    if (!descricao.trim() || !valor || !accountId || !data) { setErro("Preencha descrição, valor, conta e data."); return; }
    setSalvando(true);
    const res = await fetch("/api/receitas-agendadas", {
      method: "POST",
      body: JSON.stringify({
        descricao: descricao.trim(), valor_centavos: valor,
        account_id: accountId, data_prevista: data, recorrencia, pessoa,
        data_fim: recorrencia === "mensal" ? (dataFim || null) : null,
      }),
    }).catch(() => null);
    setSalvando(false);
    if (!res?.ok) { setErro("Não consegui salvar."); return; }
    setDescricao(""); setValor(0); setData(hoje); setRecorrencia("unica"); setDataFim(""); setAberto(false); router.refresh();
  }

  if (!aberto) return <Button variant="ghost" onClick={() => setAberto(true)}>+ Agendar receita</Button>;

  const selectStyle: React.CSSProperties = {
    width: "100%", minWidth: 0, boxSizing: "border-box", padding: "11px 12px", borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "1rem",
  };

  return (
    <div style={{ display: "grid", gap: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, background: "var(--surface)" }}>
      <Field label="O que é (descrição)" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: freela do site, reembolso do João" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
        <MoneyField label="Valor (R$)" centavos={valor} onCentavos={setValor} placeholder="500,00" />
        <Field label="Quando (data prevista)" type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </div>
      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Pra onde vai (conta)</span>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={selectStyle}>
          {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.titular ? ` (${c.titular})` : ""}</option>)}
        </select>
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Recorrência</span>
          <select value={recorrencia} onChange={(e) => setRecorrencia(e.target.value as "unica" | "mensal")} style={selectStyle}>
            <option value="unica">Única (uma vez)</option>
            <option value="mensal">Mensal (todo mês)</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>De quem</span>
          <select value={pessoa} onChange={(e) => setPessoa(e.target.value)} style={selectStyle}>
            {membros.map((m) => <option key={m} value={m}>{m}</option>)}
            <option value="conjunto">Conjunto</option>
          </select>
        </label>
      </div>
      {recorrencia === "mensal" && (
        <Field label="Até quando (opcional)" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
      )}
      {erro && <p style={{ color: "var(--negativo)", margin: 0, fontSize: "0.85rem" }}>{erro}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="primary" onClick={salvar} disabled={salvando} style={{ flex: 1 }}>Agendar receita</Button>
        <Button variant="quiet" onClick={() => setAberto(false)}>Cancelar</Button>
      </div>
    </div>
  );
}
