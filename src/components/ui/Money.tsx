import { centavosParaReais } from "@/lib/financeiro/dinheiro";

export function Money({
  centavos, sinal = false, tamanho = "md",
}: { centavos: number; sinal?: boolean; tamanho?: "sm" | "md" | "lg" | "xl" | "tile" }) {
  const cor = !sinal ? "var(--text)" : centavos < 0 ? "var(--negativo)" : "var(--positivo)";
  // "tile": fluido — encolhe em tiles estreitos (mobile) e cresce até 1.5rem no desktop
  const sizes = {
    sm: "0.8125rem", md: "0.95rem", lg: "1.5rem", xl: "2.25rem",
    tile: "clamp(1rem, 4.8vw, 1.5rem)",
  } as const;
  return (
    <span className="mono" style={{ color: cor, fontWeight: 600, fontSize: sizes[tamanho], letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
      {centavosParaReais(centavos)}
    </span>
  );
}
