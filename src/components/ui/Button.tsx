export function Button({
  children,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  const base = { border: "1px solid var(--borda)", borderRadius: "10px", padding: "10px 14px", fontWeight: 600, cursor: "pointer" } as const;
  const styles =
    variant === "primary"
      ? { ...base, background: "var(--accent)", color: "#fff", border: "none" }
      : { ...base, background: "transparent", color: "var(--text)" };
  return <button style={styles} {...props}>{children}</button>;
}
