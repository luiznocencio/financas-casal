"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoneyField } from "@/components/ui/MoneyField";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

type Origem = { id: string; nome: string; titular?: string | null };

export function AddRecorrente({
  cartoes, contas, categorias, membros,
}: { cartoes: Origem[]; contas: Origem[]; categorias: { id: string; nome: string }[]; membros: string[] }) {
  const router = useRouter();
  const membrosSet = new Set(membros);
  const origemInicial = cartoes[0] ? `card:${cartoes[0].id}` : contas[0] ? `acc:${contas[0].id}` : "";

  const [aberto, setAberto] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState(0);
  const [dia, setDia] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [origem, setOrigem] = useState(origemInicial);
  const [categoriaId, setCategoriaId] = useState("");
  const [pessoa, setPessoa] = useState<string>(() => titularDe(origemInicial) ?? membros[0] ?? "conjunto");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function titularDe(origemVal: string): string | null {
    const [prefixo, id] = origemVal.split(":");
    const item = (prefixo === "card" ? cartoes : contas).find((x) => x.id === id);
    return item?.titular && membrosSet.has(item.titular) ? item.titular : null;
  }

  async function salvar() {
    setErro(null);
    const d = Number(dia);
    if (!descricao.trim() || !valor || !(d >= 1 && d <= 31)) { setErro("Preencha descrição, valor e dia (1 a 31)."); return; }
    const [prefixo, id] = origem.split(":");
    setSalvando(true);
    const res = await fetch("/api/recorrentes", {
      method: "POST",
      body: JSON.stringify({
        descricao: descricao.trim(), valor_centavos: valor, dia: d,
        categoria_id: categoriaId || null, pessoa,
        account_id: prefixo === "acc" ? id : null, card_id: prefixo === "card" ? id : null,
        data_fim: dataFim || null,
      }),
    }).catch(() => null);
    setSalvando(false);
    if (!res?.ok) { setErro("Não consegui salvar."); return; }
    setDescricao(""); setValor(0); setDia(""); setDataFim(""); setCategoriaId(""); setAberto(false); router.refresh();
  }

  if (!aberto) return <Button variant="ghost" onClick={() => setAberto(true)}>+ Novo gasto fixo</Button>;

  const selectStyle: React.CSSProperties = {
    width: "100%", minWidth: 0, boxSizing: "border-box", padding: "11px 12px", borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "1rem",
  };

  return (
    <div style={{ display: "grid", gap: 12, border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, background: "var(--surface)" }}>
      <Field label="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Netflix, aluguel, academia" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
        <MoneyField label="Valor (R$)" centavos={valor} onCentavos={setValor} placeholder="49,90" />
        <Field label="Dia do mês" type="number" value={dia} onChange={(e) => setDia(e.target.value)} placeholder="10" />
      </div>
      <Field label="Até quando (opcional)" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>De onde sai o dinheiro</span>
        <select value={origem} onChange={(e) => { const v = e.target.value; setOrigem(v); const t = titularDe(v); if (t) setPessoa(t); }} style={selectStyle}>
          {cartoes.map((c) => <option key={c.id} value={`card:${c.id}`}>Cartão · {c.nome}{c.titular ? ` (${c.titular})` : ""}</option>)}
          {contas.map((c) => <option key={c.id} value={`acc:${c.id}`}>Conta · {c.nome}{c.titular ? ` (${c.titular})` : ""}</option>)}
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
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Pessoa</span>
          <select value={pessoa} onChange={(e) => setPessoa(e.target.value)} style={selectStyle}>
            {membros.map((m) => <option key={m} value={m}>{m}</option>)}
            <option value="conjunto">Conjunto</option>
          </select>
        </label>
      </div>
      {erro && <p style={{ color: "var(--negativo)", margin: 0, fontSize: "0.85rem" }}>{erro}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="primary" onClick={salvar} disabled={salvando} style={{ flex: 1 }}>Salvar gasto fixo</Button>
        <Button variant="quiet" onClick={() => setAberto(false)}>Cancelar</Button>
      </div>
    </div>
  );
}
