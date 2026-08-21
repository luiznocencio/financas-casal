import { centavosParaReais } from "@/lib/financeiro/dinheiro";

export function Money({
  centavos, sinal = false, tamanho = "md",
}: { centavos: number; sinal?: boolean; tamanho?: "sm" | "md" | "lg" | "xl" }) {
  const cor = !sinal ? "var(--text)" : centavos < 0 ? "var(--negativo)" : "var(--positivo)";
  const sizes = { sm: "0.8125rem", md: "0.95rem", lg: "1.5rem", xl: "2.25rem" } as const;
  return (
    <span className="mono" style={{ color: cor, fontWeight: 600, fontSize: sizes[tamanho], letterSpacing: "-0.01em" }}>
      {centavosParaReais(centavos)}
    </span>
  );
}
