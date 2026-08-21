import { corDaPessoa } from "@/lib/ui/pessoas";
import { Money } from "./Money";

export function SplitBar({
  itens, membros,
}: { itens: { nome: string; centavos: number }[]; membros: string[] }) {
  const total = itens.reduce((s, i) => s + i.centavos, 0);
  if (total <= 0) {
    return <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: 0 }}>Nenhum gasto este mês.</p>;
  }
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", height: 12, borderRadius: 999, overflow: "hidden", background: "var(--surface-2)" }}>
        {itens.map((i) => (
          <div key={i.nome} title={i.nome}
            style={{ width: `${(i.centavos / total) * 100}%`, background: corDaPessoa(i.nome, membros) }} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        {itens.map((i) => (
          <span key={i.nome} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.85rem" }}>
            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: corDaPessoa(i.nome, membros) }} />
            <span style={{ color: "var(--muted)" }}>{i.nome}</span>
            <Money centavos={i.centavos} tamanho="sm" />
          </span>
        ))}
      </div>
    </div>
  );
}
