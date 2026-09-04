"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ordenarComSubcategorias } from "@/lib/ui/categorias";

type Cat = { id: string; nome: string; parent_id?: string | null; tipo?: string };

export function FiltrosExtrato({
  categorias, cartoes, membros,
}: {
  categorias: Cat[];
  cartoes: { id: string; nome: string }[];
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
  const temFiltro = !!(tipo || origem || categoria || pessoa || card || sp.get("invoice"));

  function irPara(mut: (p: URLSearchParams) => void) {
    const p = new URLSearchParams(sp.toString());
    mut(p);
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }
  // troca um parâmetro simples
  const setParam = (chave: string, valor: string) => irPara((p) => { valor ? p.set(chave, valor) : p.delete(chave); });
  // troca a origem (limpa o cartão específico e a fatura, que conflitam)
  const setOrigem = (valor: string) => irPara((p) => { valor ? p.set("origem", valor) : p.delete("origem"); p.delete("card"); p.delete("invoice"); });

  // categorias oferecidas seguem o tipo selecionado (se houver)
  const catsOpts = ordenarComSubcategorias(tipo ? categorias.filter((c) => c.tipo === tipo) : categorias);

  const chip = (ativo: boolean): React.CSSProperties => ({
    padding: "5px 12px", borderRadius: 999, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
    border: `1px solid ${ativo ? "var(--accent)" : "var(--border)"}`,
    background: ativo ? "var(--accent-weak)" : "transparent",
    color: ativo ? "var(--accent)" : "var(--muted)",
  });
  const selectStyle: React.CSSProperties = {
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
        <select value={categoria} onChange={(e) => setParam("categoria", e.target.value)} style={selectStyle}>
          <option value="">Todas as categorias</option>
          {catsOpts.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
        </select>
        {membros.length > 0 && (
          <select value={pessoa} onChange={(e) => setParam("pessoa", e.target.value)} style={selectStyle}>
            <option value="">Todas as pessoas</option>
            {membros.map((m) => <option key={m} value={m}>{m}</option>)}
            <option value="conjunto">Conjunto</option>
          </select>
        )}
        {origem !== "pix" && cartoes.length > 0 && (
          <select value={card} onChange={(e) => setParam("card", e.target.value)} style={selectStyle}>
            <option value="">Todos os cartões</option>
            {cartoes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        )}
        {temFiltro && (
          <button onClick={() => router.push(pathname)} className="text-xs text-[var(--accent)] hover:underline">Limpar filtros</button>
        )}
      </div>
    </div>
  );
}
