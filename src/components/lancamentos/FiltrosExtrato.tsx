"use client";
import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

type Cat = { id: string; nome: string; parent_id?: string | null; tipo?: string };
type Cartao = { id: string; nome: string; titular?: string | null };

export function FiltrosExtrato({
  categorias, cartoes, membros,
}: {
  categorias: Cat[];
  cartoes: Cartao[];
  membros: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const tipo = sp.get("tipo") ?? "";
  const origem = sp.get("origem") ?? "";
  const categoria = sp.get("categoria") ?? "";
  const pessoa = sp.get("pessoa") ?? "";
  const card = sp.get("card") ?? "";
  const de = sp.get("de") ?? "";
  const ate = sp.get("ate") ?? "";
  const [busca, setBusca] = useState(sp.get("busca") ?? "");
  const temFiltro = !!(tipo || origem || categoria || pessoa || card || de || ate || sp.get("busca") || sp.get("invoice"));

  function irPara(mut: (p: URLSearchParams) => void) {
    const p = new URLSearchParams(sp.toString());
    mut(p);
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }
  const setParam = (chave: string, valor: string) => irPara((p) => { valor ? p.set(chave, valor) : p.delete(chave); });
  const setOrigem = (valor: string) => irPara((p) => { valor ? p.set("origem", valor) : p.delete("origem"); p.delete("card"); p.delete("invoice"); });
  const setPessoa = (valor: string) => irPara((p) => { valor ? p.set("pessoa", valor) : p.delete("pessoa"); p.delete("card"); });
  const buscar = () => setParam("busca", busca.trim());

  // categoria em dois níveis: mãe + (opcional) subcategoria
  const catAtual = categorias.find((c) => c.id === categoria);
  const maeId = catAtual ? (catAtual.parent_id ?? catAtual.id) : "";
  const maes = categorias.filter((c) => !c.parent_id && (!tipo || c.tipo === tipo));
  const filhos = maeId ? categorias.filter((c) => c.parent_id === maeId) : [];

  // cartões oferecidos: os da pessoa (se filtrada), com titular pra desambiguar
  const cartoesOpts = (pessoa ? cartoes.filter((c) => c.titular === pessoa) : cartoes);
  const rotuloCartao = (c: Cartao) => (c.titular ? `${c.nome} · ${c.titular}` : c.nome);

  const chip = (ativo: boolean): React.CSSProperties => ({
    padding: "5px 12px", borderRadius: 999, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
    border: `1px solid ${ativo ? "var(--accent)" : "var(--border)"}`,
    background: ativo ? "var(--accent-weak)" : "transparent",
    color: ativo ? "var(--accent)" : "var(--muted)",
  });
  const campo: React.CSSProperties = {
    padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
    background: "var(--surface)", color: "var(--text)", fontSize: "0.85rem", maxWidth: "100%",
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-[var(--muted)]">Tipo:</span>
        <button onClick={() => setParam("tipo", "")} style={chip(!tipo)}>Todos</button>
        <button onClick={() => setParam("tipo", "despesa")} style={chip(tipo === "despesa")}>Despesas</button>
        <button onClick={() => setParam("tipo", "receita")} style={chip(tipo === "receita")}>Receitas</button>
        <span className="ml-2 text-xs text-[var(--muted)]">Origem:</span>
        <button onClick={() => setOrigem("")} style={chip(!origem && !card)}>Tudo</button>
        <button onClick={() => setOrigem("cartao")} style={chip(origem === "cartao")}>Cartão</button>
        <button onClick={() => setOrigem("pix")} style={chip(origem === "pix")}>Pix</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={maeId} onChange={(e) => setParam("categoria", e.target.value)} style={campo}>
          <option value="">Todas as categorias</option>
          {maes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        {filhos.length > 0 && (
          <select value={categoria} onChange={(e) => setParam("categoria", e.target.value)} style={campo}>
            <option value={maeId}>Toda a categoria</option>
            {filhos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        )}
        {membros.length > 0 && (
          <select value={pessoa} onChange={(e) => setPessoa(e.target.value)} style={campo}>
            <option value="">Todas as pessoas</option>
            {membros.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        {origem !== "pix" && cartoesOpts.length > 0 && (
          <select value={card} onChange={(e) => setParam("card", e.target.value)} style={campo}>
            <option value="">Todos os cartões</option>
            {cartoesOpts.map((c) => <option key={c.id} value={c.id}>{rotuloCartao(c)}</option>)}
          </select>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-[var(--muted)]">Período:</span>
        <input type="date" value={de} onChange={(e) => setParam("de", e.target.value)} style={campo} title="De" />
        <span className="text-xs text-[var(--muted)]">até</span>
        <input type="date" value={ate} onChange={(e) => setParam("ate", e.target.value)} style={campo} title="Até" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") buscar(); }} onBlur={buscar}
          placeholder="Buscar na descrição…" style={{ ...campo, flex: 1, minWidth: 160 }} />
        {temFiltro && (
          <button onClick={() => { setBusca(""); router.push(pathname); }} className="text-xs text-[var(--accent)] hover:underline">Limpar filtros</button>
        )}
      </div>
    </div>
  );
}
