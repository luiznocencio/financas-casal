export function Marca({ size = 40 }: { size?: number }) {
  return (
    <span aria-hidden style={{ display: "inline-flex" }}>
      <svg width={size} height={size} viewBox="0 0 64 64">
        <defs><clipPath id="marca-r"><rect width="64" height="64" rx="15" /></clipPath></defs>
        <g clipPath="url(#marca-r)">
          <rect width="32" height="64" fill="var(--pessoa-a)" />
          <rect x="32" width="32" height="64" fill="var(--pessoa-b)" />
        </g>
        <text x="32" y="44" fontFamily="var(--font-sans), sans-serif" fontSize="34" fontWeight="800" fill="#fff" textAnchor="middle">R$</text>
      </svg>
    </span>
  );
}
