import { Money } from "./Money";

export function StatTile({
  rotulo, valorCentavos, sinal = false, hint,
}: { rotulo: string; valorCentavos: number; sinal?: boolean; hint?: string }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: "var(--radius)", padding: "16px 18px", display: "grid", gap: 6,
      minWidth: 0, overflow: "hidden", // não deixa o valor vazar do card
      containerType: "inline-size",    // o valor (cqi) escala pela largura do card
    }}>
      <span style={{ fontSize: "0.78rem", color: "var(--muted)", letterSpacing: "0.01em" }}>{rotulo}</span>
      <Money centavos={valorCentavos} sinal={sinal} tamanho="tile" />
      {hint && <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{hint}</span>}
    </div>
  );
}
