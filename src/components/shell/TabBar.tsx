"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS = [
  { href: "/", rotulo: "Início" },
  { href: "/cartoes", rotulo: "Cartões" },
  { href: "/contas", rotulo: "Contas" },
  { href: "/lancamentos", rotulo: "Extrato" },
  { href: "/orcamento", rotulo: "Orçamento" },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav aria-label="Navegação principal"
      style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40,
        background: "var(--surface)", borderTop: "1px solid var(--border)",
        display: "flex", justifyContent: "space-around", padding: "8px 8px calc(8px + env(safe-area-inset-bottom))",
      }}
      className="tabbar">
      {ITENS.map((it) => {
        const ativo = it.href === "/" ? path === "/" : path.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href}
            style={{
              flex: 1, textAlign: "center", fontSize: "0.78rem", fontWeight: 600,
              color: ativo ? "var(--accent)" : "var(--muted)", padding: "6px 0",
            }}>
            {it.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
