"use client";
import { useRef, useState } from "react";
import type { Card, Account, Category } from "@/lib/db/tipos";
import { reaisParaCentavos } from "@/lib/financeiro/dinheiro";
import { Button } from "@/components/ui/Button";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { ordenarComSubcategorias } from "@/lib/ui/categorias";
import { hojeISO } from "@/lib/financeiro/fechamento";

export function FormularioRapido({
  cartoes, contas, categorias, usuarioAtual, cartaoPrincipalId, valorInicialReais = "", inicial, onCriado,
}: {
  cartoes: Card[]; contas: Account[]; categorias: Category[];
  usuarioAtual: string; cartaoPrincipalId: string | null; valorInicialReais?: string; onCriado: () => void;
  // valores pré-preenchidos (ex.: vindo da sugestão da IA ao clicar "Ajustar")
  inicial?: {
    descricao?: string | null; tipo?: "despesa" | "receita"; categoria_id?: string | null;
    total_parcelas?: number; card_id?: string | null; account_id?: string | null;
    data?: string | null;
  };
}) {
  type TipoOrigem = "card" | "acc";
  // 1º destino do tipo: o cartão principal de quem está lançando; senão um do próprio usuário
  function primeiroDoTipo(tipo: TipoOrigem): string {
    const lista = tipo === "card" ? cartoes : contas;
    if (tipo === "card" && cartaoPrincipalId && cartoes.some((c) => c.id === cartaoPrincipalId)) return cartaoPrincipalId;
    return (lista.find((x) => x.titular === usuarioAtual) ?? lista[0])?.id ?? "";
  }
  // origem inicial: respeita a sugestão (card/conta) se ela existir; senão prefere cartão
  const origemInicial: { tipo: TipoOrigem; id: string } =
    inicial?.card_id && cartoes.some((c) => c.id === inicial.card_id) ? { tipo: "card", id: inicial.card_id }
      : inicial?.account_id && contas.some((c) => c.id === inicial.account_id) ? { tipo: "acc", id: inicial.account_id }
        : (() => {
            const t: TipoOrigem = cartoes.length > 0 ? "card" : contas.length > 0 ? "acc" : "card";
            return { tipo: t, id: primeiroDoTipo(t) };
          })();

  const [centavos, setCentavos] = useState(valorInicialReais ? reaisParaCentavos(valorInicialReais) : 0);
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [observacao, setObservacao] = useState("");
  const [tipo, setTipo] = useState<"despesa" | "receita">(inicial?.tipo ?? "despesa");
  const [tipoOrigem, setTipoOrigem] = useState<TipoOrigem>(origemInicial.tipo);
  const [origemId, setOrigemId] = useState<string>(origemInicial.id);
  const [categoriaId, setCategoriaId] = useState<string>(inicial?.categoria_id ?? "");
  const [parcelas, setParcelas] = useState(inicial?.total_parcelas && inicial.total_parcelas > 0 ? inicial.total_parcelas : 1);
  const hoje = hojeISO();
  const [data, setData] = useState(inicial?.data ?? hoje);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  // trava síncrona: cliques rápidos não passam antes do estado re-renderizar
  const enviando = useRef(false);

  function trocarTipo(t: TipoOrigem) {
    setTipoOrigem(t);
    setOrigemId(primeiroDoTipo(t));
  }
  // categorias do tipo do lançamento (não misturar receita/despesa)
  const catsDoTipo = categorias.filter((c) => c.tipo === tipo);
  function trocarTipoLancamento(t: "despesa" | "receita") {
    setTipo(t);
    // se a categoria escolhida não é do novo tipo, limpa
    if (categoriaId && !categorias.some((c) => c.id === categoriaId && c.tipo === t)) setCategoriaId("");
  }

  async function salvar() {
    if (enviando.current) return; // já está salvando: ignora clique repetido
    setErro(null);
    if (!origemId) { setErro("Escolha o cartão/conta."); return; }
    enviando.current = true;
    setSalvando(true);
    const body = {
      tipo, valor_centavos: centavos,
      data_compra: data,
      categoria_id: categoriaId || null,
      account_id: tipoOrigem === "acc" ? origemId : null,
      card_id: tipoOrigem === "card" ? origemId : null,
      total_parcelas: tipoOrigem === "card" ? parcelas : 1,
      descricao: descricao.trim() || null,
      observacao: observacao.trim() || null,
    };
    try {
      const res = await fetch("/api/transactions", { method: "POST", body: JSON.stringify(body) });
      if (!res.ok) { setErro("Não foi possível salvar. Tente novamente."); return; }
      onCriado();
    } catch {
      setErro("Não foi possível salvar. Tente novamente.");
    } finally {
      enviando.current = false;
      setSalvando(false);
    }
  }

  const selectStyle: React.CSSProperties = {
    padding: "9px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
    background: "var(--surface)", color: "var(--text)", fontSize: "0.9rem", minWidth: 0, width: "100%",
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
    // minmax(0, …) e minWidth 0 em tudo: no celular nenhum campo pode esticar a folha além da tela
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10 }}>
      {/* valor + tipo na mesma linha */}
      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
        <MoneyInput centavos={centavos} onCentavos={setCentavos} autoFocus placeholder="Valor (R$)" className="mono"
          style={{
            flex: 1, minWidth: 0, fontSize: "1.5rem", fontWeight: 700, padding: "8px 12px", textAlign: "center",
            fontVariantNumeric: "tabular-nums", borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)",
          }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 96, flexShrink: 0 }}>
          <button onClick={() => trocarTipoLancamento("despesa")} aria-pressed={tipo === "despesa"} style={{ ...chipStyle(tipo === "despesa"), padding: "6px 8px" }}>Despesa</button>
          <button onClick={() => trocarTipoLancamento("receita")} aria-pressed={tipo === "receita"} style={{ ...chipStyle(tipo === "receita"), padding: "6px 8px" }}>Receita</button>
        </div>
      </div>

      {/* nome/descrição + data da compra */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 132px)", gap: 8 }}>
        <input value={descricao} onChange={(e) => setDescricao(e.target.value)}
          placeholder="Nome (ex.: mercado)"
          style={{ ...selectStyle, fontSize: "1rem" }} />
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} title="Data da compra"
          style={{ ...selectStyle, fontSize: "0.9rem" }} />
      </div>

      {/* 1º passo: cartão ou pix */}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => trocarTipo("card")} disabled={cartoes.length === 0}
          aria-pressed={tipoOrigem === "card"} style={{ ...chipStyle(tipoOrigem === "card"), opacity: cartoes.length === 0 ? 0.5 : 1 }}>Cartão</button>
        <button type="button" onClick={() => trocarTipo("acc")} disabled={contas.length === 0}
          aria-pressed={tipoOrigem === "acc"} style={{ ...chipStyle(tipoOrigem === "acc"), opacity: contas.length === 0 ? 0.5 : 1 }}>Pix</button>
      </div>
      {/* 2º passo: qual destino (+ parcelas quando cartão) */}
      <div style={{ display: "grid", gridTemplateColumns: tipoOrigem === "card" ? "minmax(0, 1fr) 72px" : "minmax(0, 1fr)", gap: 8 }}>
        <select value={origemId} onChange={(e) => setOrigemId(e.target.value)} style={selectStyle}>
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

      {/* categoria (de quem é o gasto sai do cartão/conta escolhido) */}
      <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} style={selectStyle}>
        <option value="">Sem categoria</option>
        {ordenarComSubcategorias(catsDoTipo).map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
      </select>

      {/* observação opcional — a mesma que aparece no extrato */}
      <input value={observacao} onChange={(e) => setObservacao(e.target.value)}
        placeholder="Observação (opcional): o que foi essa compra?"
        style={{ ...selectStyle, fontSize: "0.9rem" }} />

      {erro && <p style={{ color: "var(--negativo)", margin: 0, fontSize: "0.85rem" }}>{erro}</p>}
      <Button variant="primary" onClick={salvar} disabled={salvando} aria-busy={salvando} style={{ width: "100%" }}>
        {salvando ? "Salvando…" : "Salvar"}
      </Button>
    </div>
  );
}
