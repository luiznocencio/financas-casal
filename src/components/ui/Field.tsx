export function Field({
  label, ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{label}</span>
      <input {...props} style={{
        padding: "11px 12px", borderRadius: "var(--radius-sm)",
        border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)",
        fontSize: "1rem", ...(props.style ?? {}),
      }} />
    </label>
  );
}
