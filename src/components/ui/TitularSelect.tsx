// Seletor do dono (titular) travado nos membros do lar — garante que o titular
// case exatamente com um membro (pra cor/associação de pessoa funcionarem).
export function TitularSelect({
  value, onChange, membros, label = "Titular (dono)",
}: { value: string; onChange: (v: string) => void; membros: string[]; label?: string }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", minWidth: 0, boxSizing: "border-box", padding: "11px 12px",
          borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
          background: "var(--surface)", color: "var(--text)", fontSize: "1rem",
        }}>
        <option value="">— (conjunto)</option>
        {membros.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
    </label>
  );
}
