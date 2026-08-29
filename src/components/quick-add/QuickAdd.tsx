"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkle } from "@phosphor-icons/react";
import type { Card, Account, Category } from "@/lib/db/tipos";
import type { SugestaoLancamento } from "@/lib/ai/lancamento";
import { FormularioRapido } from "./FormularioRapido";
import { Button } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { Spinner } from "@/components/ui/Spinner";

export function QuickAdd({
  cartoes, contas, categorias, membros, usuarioAtual,
}: { cartoes: Card[]; contas: Account[]; categorias: Category[]; membros: string[]; usuarioAtual: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [sugestao, setSugestao] = useState<SugestaoLancamento | null>(null);
  const [modoForm, setModoForm] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function fechar() {
    setAberto(false); setTexto(""); setSugestao(null); setModoForm(false); setErro(null);
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
    setErro(null);
    const res = await fetch("/api/transactions", {
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
    if (!res.ok) {
      setErro("Não foi possível salvar. Tente novamente.");
      return;
    }
    recarregar();
  }

  return (
    <>
      <button onClick={() => setAberto(true)} aria-label="Novo lançamento"
        style={{
          position: "fixed", right: 20, bottom: 76, width: 60, height: 60, borderRadius: 30,
          background: "var(--accent)", color: "#fff", fontSize: 30, lineHeight: "60px", textAlign: "center",
          border: "none", cursor: "pointer", boxShadow: "var(--shadow)", zIndex: 40,
        }}>
        +
      </button>

      {aberto && (
        <div onClick={fechar}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface)", borderRadius: "18px 18px 0 0", padding: "12px 20px 28px",
              width: "100%", maxWidth: 720, display: "grid", gap: 4,
            }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border)", margin: "0 auto 12px" }} />

            {/* MODO PADRÃO: linguagem natural */}
            {!modoForm && !sugestao && (
              <div style={{ display: "grid", gap: 12 }}>
                <input autoFocus placeholder='Ex.: "mercado 250 no crédito do Nubank"'
                  value={texto} onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && interpretar()}
                  style={{
                    padding: "14px 14px", fontSize: 18, fontFamily: "var(--font-sans)",
                    borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
                    background: "var(--surface)", color: "var(--text)",
                  }} />
                <Button variant="primary" tamanho="lg" onClick={interpretar} disabled={carregando || !texto} style={{ width: "100%" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    {carregando ? (
                      <>
                        <Spinner size={14} /> Interpretando...
                      </>
                    ) : (
                      <>
                        <Sparkle size={16} /> Lançar
                      </>
                    )}
                  </span>
                </Button>
                <Button variant="quiet" onClick={() => setModoForm(true)} style={{ justifySelf: "center" }}>
                  Preencher manualmente
                </Button>
              </div>
            )}

            {/* REVISÃO da sugestão da IA */}
            {sugestao && !modoForm && (
              <div style={{ display: "grid", gap: 10 }}>
                <h3 style={{ margin: 0 }}>Confirme o lançamento</h3>
                <div style={{ display: "grid", gap: 2 }}>
                  <Money centavos={sugestao.valor_centavos} tamanho="xl" />
                  <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                    {sugestao.descricao}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 10, color: "var(--muted)", fontSize: "0.9rem" }}>
                  <span>{sugestao.card_id ? "Cartão" : "Conta"} · {sugestao.pessoa}</span>
                  {sugestao.total_parcelas > 1 && <span>{sugestao.total_parcelas}x</span>}
                </div>
                {erro && <p style={{ color: "var(--negativo)", margin: 0, fontSize: "0.9rem" }}>{erro}</p>}
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="primary" tamanho="lg" onClick={confirmar} style={{ flex: 1 }}>Confirmar</Button>
                  <Button variant="ghost" tamanho="lg" onClick={() => setModoForm(true)}>Ajustar</Button>
                </div>
              </div>
            )}

            {/* FALLBACK: formulário rápido */}
            {modoForm && (
              <FormularioRapido
                cartoes={cartoes} contas={contas} categorias={categorias} membros={membros}
                usuarioAtual={usuarioAtual}
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
