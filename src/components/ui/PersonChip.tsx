import { corDaPessoa } from "@/lib/ui/pessoas";

export function PersonChip({ nome, membros }: { nome: string; membros: string[] }) {
  const cor = corDaPessoa(nome, membros);
  const inicial = (nome?.[0] ?? "?").toUpperCase();
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.8rem", color: "var(--muted)" }}>
      <span aria-hidden style={{
        width: 20, height: 20, borderRadius: 999, background: cor, color: "#fff",
        display: "grid", placeItems: "center", fontSize: "0.7rem", fontWeight: 700,
      }}>{inicial}</span>
      {nome}
    </span>
  );
}
