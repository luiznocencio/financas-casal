import { centavosParaReais } from "@/lib/financeiro/dinheiro";

export function Money({
  centavos,
  sinal = false,
}: {
  centavos: number;
  sinal?: boolean;
}) {
  const cor =
    !sinal ? "var(--text)" : centavos < 0 ? "var(--negativo)" : "var(--positivo)";
  return (
    <span className="tabular" style={{ color: cor, fontWeight: 600 }}>
      {centavosParaReais(centavos)}
    </span>
  );
}
