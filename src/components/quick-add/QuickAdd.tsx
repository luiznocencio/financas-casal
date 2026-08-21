"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Card, Account, Category } from "@/lib/db/tipos";
import type { SugestaoLancamento } from "@/lib/ai/lancamento";
import { FormularioRapido } from "./FormularioRapido";
import { centavosParaReais } from "@/lib/financeiro/dinheiro";

export function QuickAdd({
  cartoes, contas, categorias, membros,
}: { cartoes: Card[]; contas: Account[]; categorias: Category[]; membros: string[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [sugestao, setSugestao] = useState<SugestaoLancamento | null>(null);
  const [modoForm, setModoForm] = useState(false);

  function fechar() {
    setAberto(false); setTexto(""); setSugestao(null); setModoForm(false);
  }
  function recarregar() { fechar(); router.refresh(); }

  async function interpretar() {
    setCarregando(true);
    try {
      const r = await fetch("/api/transactions/parse", {
        method: "POST", body: JSON.stringify({ texto }),
      }).then((x) => x.json());
      if (r.ok) setSugestao(r.sugestao);
      else setModoForm(true); // fallback automático
    } catch {
      setModoForm(true);
    } finally {
      setCarregando(false);
    }
  }

  async function confirmar() {
    if (!sugestao) return;
    await fetch("/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        tipo: sugestao.tipo, valor_centavos: sugestao.valor_centavos,
        data_compra: new Date().toISOString().slice(0, 10),
        categoria_id: sugestao.categoria_id, pessoa: sugestao.pessoa,
        account_id: sugestao.account_id, card_id: sugestao.card_id,
        total_parcelas: sugestao.total_parcelas, descricao: sugestao.descricao,
        origem_ia: true,
      }),
    });
    recarregar();
  }

  return (
    <>
      <button onClick={() => setAberto(true)} aria-label="Novo lançamento"
        style={{ position: "fixed", right: 20, bottom: 20, width: 60, height: 60, borderRadius: 30,
          background: "var(--accent)", color: "#fff", fontSize: 30, border: "none", cursor: "pointer" }}>
        +
      </button>

      {aberto && (
        <div onClick={fechar}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--surface)", borderRadius: "16px 16px 0 0", padding: 20, width: "100%", maxWidth: 720 }}>

            {/* MODO PADRÃO: linguagem natural */}
            {!modoForm && !sugestao && (
              <div style={{ display: "grid", gap: 12 }}>
                <input autoFocus placeholder='Ex.: "mercado 250 no crédito do Nubank"'
                  value={texto} onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && interpretar()}
                  style={{ padding: 14, fontSize: 18 }} />
                <button onClick={interpretar} disabled={carregando || !texto}
                  style={{ padding: 12, fontWeight: 700 }}>
                  {carregando ? "Interpretando..." : "Lançar"}
                </button>
                <button onClick={() => setModoForm(true)} style={{ background: "none", border: "none", color: "var(--muted)" }}>
                  Preencher manualmente
                </button>
              </div>
            )}

            {/* REVISÃO da sugestão da IA */}
            {sugestao && !modoForm && (
              <div style={{ display: "grid", gap: 8 }}>
                <h3>Confirme o lançamento</h3>
                <p><b>{centavosParaReais(sugestao.valor_centavos)}</b> · {sugestao.tipo} · {sugestao.descricao}</p>
                <p style={{ color: "var(--muted)" }}>
                  {sugestao.card_id ? "Cartão" : "Conta"} · {sugestao.pessoa}
                  {sugestao.total_parcelas > 1 ? ` · ${sugestao.total_parcelas}x` : ""}
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={confirmar} style={{ flex: 1, padding: 12, fontWeight: 700 }}>Confirmar</button>
                  <button onClick={() => setModoForm(true)}>Ajustar</button>
                </div>
              </div>
            )}

            {/* FALLBACK: formulário rápido */}
            {modoForm && (
              <FormularioRapido
                cartoes={cartoes} contas={contas} categorias={categorias} membros={membros}
                valorInicialReais={sugestao ? (sugestao.valor_centavos / 100).toString() : ""}
                onCriado={recarregar}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
