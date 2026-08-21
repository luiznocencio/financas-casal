export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={className}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--borda)",
        borderRadius: "var(--radius)",
        padding: "16px",
      }}
    >
      {children}
    </div>
  );
}
