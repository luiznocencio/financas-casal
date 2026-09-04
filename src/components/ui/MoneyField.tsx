"use client";
import { MoneyInput } from "./MoneyInput";

// Campo de valor rotulado com máscara centavos-primeiro (mesma cara do Field).
export function MoneyField({
  label, centavos, onCentavos, placeholder,
}: { label: string; centavos: number; onCentavos: (v: number) => void; placeholder?: string }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{label}</span>
      <MoneyInput centavos={centavos} onCentavos={onCentavos} placeholder={placeholder}
        style={{
          width: "100%", minWidth: 0, boxSizing: "border-box",
          padding: "11px 12px", borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "1rem",
        }} />
    </label>
  );
}
