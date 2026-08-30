"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { MoneyInput } from "@/components/ui/MoneyInput";

type Origem = { id: string; nome: string; titular?: string | null };

export function AddContaPagar({
  cartoes, contas, categorias, membros, categoriaPadrao,
}: {
  cartoes: Origem[]; contas: Origem[]; categorias: { id: string; nome: string }[];
  membros: string[]; categoriaPadrao: string;
}) {
  const router = useRouter();
  const origemInicial = contas[0] ? `acc:${contas[0].id}` : cartoes[0] ? `card:${cartoes[0].id}` : "";

  const [aberto, setAberto] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [estimado, setEstimado] = useState(0);
  const [dia, setDia] = useState("");
  const [categoriaId, setCategoriaId] = useState(categoriaPadrao);
  const [pessoa, setPessoa] = useState(membros[0] ?? "conjunto");
  const [origem, setOrigem] = useState(origemInicial);
  const [recorrencia, setRecorrencia] = useState<"mensal" | "unica">("mensal");
  const [dataFim, setDataFim] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    const d = Number(dia);
    if (!descricao.trim() || !(d >= 1 && d <= 31)) { setErro("Preencha descrição e dia de vencimento (1 a 31)."); return; }
    const [prefixo, id] = origem.split(":");
    setSalvando(true);
    const res = await fetch("/api/contas-pagar", {
      method: "POST",
      body: JSON.stringify({
        descricao: descricao.trim(), valor_estimado_centavos: estimado || null, dia_vencimento: d,
        categoria_id: categoriaId || null, pessoa,
        account_id: prefixo === "acc" ? id : null, card_id: prefixo === "card" ? id : null,
        recorrencia, data_fim: recorrencia === "mensal" ? (dataFim || null) : null,
      }),
    }).catch(() => null);
    setSalvando(false);
    if (!res?.ok) { setErro("Não consegui salvar."); return; }
    setDescricao(""); setEstimado(0); setDia(""); setDataFim(""); setRecorrencia("mensal"); setAberto(false); router.refresh();
  }

  if (!aberto) return <Button variant="ghost" onClick={() => setAberto(true)}>+ Nova conta a pagar</Button>;

  const selectStyle: React.CSSProperties = {
    width: "100%", minWidth: 0, boxSizing: "border-box", padding: "11px 12px", borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "1rem",
  };
  const inputStyle = selectStyle;

  return (
    <div style={{ display: "grid", gap: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, background: "var(--surface)" }}>
      <Field label="O que é (descrição)" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Energia, Água, Internet" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Valor estimado (R$, opcional)</span>
          <MoneyInput centavos={estimado} onCentavos={setEstimado} placeholder="—" style={inputStyle} />
        </label>
        <Field label="Dia de vencimento" type="number" value={dia} onChange={(e) => setDia(e.target.value)} placeholder="10" />
      </div>
      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>De onde sai o pagamento</span>
        <select value={origem} onChange={(e) => setOrigem(e.target.value)} style={selectStyle}>
          {contas.map((c) => <option key={c.id} value={`acc:${c.id}`}>Conta · {c.nome}{c.titular ? ` (${c.titular})` : ""}</option>)}
          {cartoes.map((c) => <option key={c.id} value={`card:${c.id}`}>Cartão · {c.nome}{c.titular ? ` (${c.titular})` : ""}</option>)}
        </select>
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Categoria</span>
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} style={selectStyle}>
            <option value="">Sem categoria</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Recorrência</span>
          <select value={recorrencia} onChange={(e) => setRecorrencia(e.target.value as "mensal" | "unica")} style={selectStyle}>
            <option value="mensal">Mensal (todo mês)</option>
            <option value="unica">Única</option>
          </select>
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>De quem</span>
          <select value={pessoa} onChange={(e) => setPessoa(e.target.value)} style={selectStyle}>
            {membros.map((m) => <option key={m} value={m}>{m}</option>)}
            <option value="conjunto">Conjunto</option>
          </select>
        </label>
        {recorrencia === "mensal" && (
          <Field label="Até quando (opcional)" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        )}
      </div>
      {erro && <p style={{ color: "var(--negativo)", margin: 0, fontSize: "0.85rem" }}>{erro}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="primary" onClick={salvar} disabled={salvando} style={{ flex: 1 }}>Salvar conta</Button>
        <Button variant="quiet" onClick={() => setAberto(false)}>Cancelar</Button>
      </div>
    </div>
  );
}
