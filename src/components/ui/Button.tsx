export function Button({
  children, variant = "primary", tamanho = "md", style, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "quiet" | "danger"; tamanho?: "md" | "lg";
}) {
  const pad = tamanho === "lg" ? "12px 18px" : "9px 14px";
  const base: React.CSSProperties = {
    borderRadius: "var(--radius-sm)", padding: pad, fontWeight: 600,
    fontSize: tamanho === "lg" ? "1rem" : "0.9rem",
    cursor: props.disabled ? "not-allowed" : "pointer",
    opacity: props.disabled ? 0.55 : 1,
    transition: "background .15s, border-color .15s, opacity .15s",
  };
  const styles: Record<string, React.CSSProperties> = {
    primary: { ...base, background: "var(--accent)", color: "#fff", border: "1px solid transparent" },
    ghost: { ...base, background: "transparent", color: "var(--text)", border: "1px solid var(--border)" },
    quiet: { ...base, background: "transparent", color: "var(--muted)", border: "1px solid transparent" },
    danger: { ...base, background: "var(--negativo)", color: "#fff", border: "1px solid transparent" },
  };
  // caller style mescla SOBRE a variante (mantém a base; não a descarta)
  return <button style={{ ...styles[variant], ...style }} {...props}>{children}</button>;
}
