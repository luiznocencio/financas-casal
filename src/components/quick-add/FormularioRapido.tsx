"use client";
import { useState } from "react";
import type { Card, Account, Category } from "@/lib/db/tipos";
import { reaisParaCentavos } from "@/lib/financeiro/dinheiro";
import { Button } from "@/components/ui/Button";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { ordenarComSubcategorias } from "@/lib/ui/categorias";

export function FormularioRapido({
  cartoes, contas, categorias, membros, usuarioAtual, valorInicialReais = "", onCriado,
}: {
  cartoes: Card[]; contas: Account[]; categorias: Category[]; membros: string[];
  usuarioAtual: string; valorInicialReais?: string; onCriado: () => void;
}) {
  const membrosSet = new Set(membros);
  type TipoOrigem = "card" | "acc";
  // dono do destino (cartão/conta), se for membro do lar — pra já sugerir a pessoa
  function titularDe(tipo: TipoOrigem, id: string): string | null {
    const item = (tipo === "card" ? cartoes : contas).find((x) => x.id === id);
    return item?.titular && membrosSet.has(item.titular) ? item.titular : null;
  }
  // 1º destino do tipo, preferindo o do próprio usuário logado
  function primeiroDoTipo(tipo: TipoOrigem): string {
    const lista = tipo === "card" ? cartoes : contas;
    return (lista.find((x) => x.titular === usuarioAtual) ?? lista[0])?.id ?? "";
  }
  // tipo inicial: onde o usuário tem algo (prefere cartão)
  const tipoInicial: TipoOrigem = cartoes.some((c) => c.titular === usuarioAtual) || cartoes.length > 0 ? "card"
    : contas.length > 0 ? "acc" : "card";
  const idInicial = primeiroDoTipo(tipoInicial);

  const [centavos, setCentavos] = useState(valorInicialReais ? reaisParaCentavos(valorInicialReais) : 0);
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<"despesa" | "receita">("despesa");
  const [tipoOrigem, setTipoOrigem] = useState<TipoOrigem>(tipoInicial);
  const [origemId, setOrigemId] = useState<string>(idInicial);
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [pessoa, setPessoa] = useState(titularDe(tipoInicial, idInicial) ?? usuarioAtual ?? membros[0] ?? "conjunto");
  const [parcelas, setParcelas] = useState(1);
  const [erro, setErro] = useState<string | null>(null);

  function trocarTipo(t: TipoOrigem) {
    setTipoOrigem(t);
    const id = primeiroDoTipo(t);
    setOrigemId(id);
    const dono = titularDe(t, id); if (dono) setPessoa(dono);
  }
  function trocarDestino(id: string) {
    setOrigemId(id);
    const dono = titularDe(tipoOrigem, id); if (dono) setPessoa(dono);
  }

  async function salvar() {
    setErro(null);
    if (!origemId) { setErro("Escolha o cartão/conta."); return; }
    const body = {
      tipo, valor_centavos: centavos,
      data_compra: new Date().toISOString().slice(0, 10),
      categoria_id: categoriaId || null, pessoa,
      account_id: tipoOrigem === "acc" ? origemId : null,
      card_id: tipoOrigem === "card" ? origemId : null,
      total_parcelas: tipoOrigem === "card" ? parcelas : 1,
      descricao: descricao.trim() || null,
    };
    const res = await fetch("/api/transactions", { method: "POST", body: JSON.stringify(body) });
    if (!res.ok) {
      setErro("Não foi possível salvar. Tente novamente.");
      return;
    }
    onCriado();
  }

  const selectStyle: React.CSSProperties = {
    padding: "9px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
    background: "var(--surface)", color: "var(--text)", fontSize: "0.9rem", minWidth: 0,
  };

  function chipStyle(ativo: boolean): React.CSSProperties {
    return {
      flex: 1, padding: "8px 12px", borderRadius: "var(--radius-sm)", fontWeight: 600, fontSize: "0.85rem",
      cursor: "pointer", border: `1px solid ${ativo ? "var(--accent)" : "var(--border)"}`,
      background: ativo ? "var(--accent-weak)" : "transparent",
      color: ativo ? "var(--accent)" : "var(--text)",
    };
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {/* valor + tipo na mesma linha */}
      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
        <MoneyInput centavos={centavos} onCentavos={setCentavos} autoFocus placeholder="Valor (R$)" className="mono"
          style={{
            flex: 1, minWidth: 0, fontSize: "1.5rem", fontWeight: 700, padding: "8px 12px", textAlign: "center",
            fontVariantNumeric: "tabular-nums", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)",
          }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 108 }}>
          <button onClick={() => setTipo("despesa")} aria-pressed={tipo === "despesa"} style={{ ...chipStyle(tipo === "despesa"), padding: "6px 8px" }}>Despesa</button>
          <button onClick={() => setTipo("receita")} aria-pressed={tipo === "receita"} style={{ ...chipStyle(tipo === "receita"), padding: "6px 8px" }}>Receita</button>
        </div>
      </div>

      {/* nome/descrição do gasto (opcional) */}
      <input value={descricao} onChange={(e) => setDescricao(e.target.value)}
        placeholder="Nome (ex.: mercado do mês)"
        style={{ ...selectStyle, fontSize: "1rem" }} />

      {/* 1º passo: cartão ou pix */}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => trocarTipo("card")} disabled={cartoes.length === 0}
          aria-pressed={tipoOrigem === "card"} style={{ ...chipStyle(tipoOrigem === "card"), opacity: cartoes.length === 0 ? 0.5 : 1 }}>Cartão</button>
        <button type="button" onClick={() => trocarTipo("acc")} disabled={contas.length === 0}
          aria-pressed={tipoOrigem === "acc"} style={{ ...chipStyle(tipoOrigem === "acc"), opacity: contas.length === 0 ? 0.5 : 1 }}>Pix</button>
      </div>
      {/* 2º passo: qual destino (+ parcelas quando cartão) */}
      <div style={{ display: "grid", gridTemplateColumns: tipoOrigem === "card" ? "1fr 84px" : "1fr", gap: 8 }}>
        <select value={origemId} onChange={(e) => trocarDestino(e.target.value)} style={selectStyle}>
          {(tipoOrigem === "card" ? cartoes : contas).map((c) => (
            <option key={c.id} value={c.id}>{c.nome}{c.titular ? ` (${c.titular})` : ""}</option>
          ))}
        </select>
        {tipoOrigem === "card" && (
          <input type="number" min={1} max={24} value={parcelas} title="Parcelas"
            onChange={(e) => setParcelas(Number(e.target.value))} placeholder="x"
            style={{ ...selectStyle, textAlign: "center" }} />
        )}
      </div>

      {/* categoria + pessoa lado a lado */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} style={selectStyle}>
          <option value="">Sem categoria</option>
          {ordenarComSubcategorias(categorias).map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
        </select>
        <select value={pessoa} onChange={(e) => setPessoa(e.target.value)} style={selectStyle}>
          {membros.map((m) => <option key={m} value={m}>{m}</option>)}
          <option value="conjunto">Conjunto</option>
        </select>
      </div>

      {erro && <p style={{ color: "var(--negativo)", margin: 0, fontSize: "0.85rem" }}>{erro}</p>}
      <Button variant="primary" onClick={salvar} style={{ width: "100%" }}>Salvar</Button>
    </div>
  );
}
