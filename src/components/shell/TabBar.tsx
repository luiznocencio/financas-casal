"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITENS, ehAtivo } from "./nav";

// Barra de navegação inferior — só no mobile (no desktop vale a Sidebar).
export function TabBar() {
  const path = usePathname();
  return (
    <nav aria-label="Navegação principal" className="lg:hidden"
      style={{
        position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40,
        background: "var(--surface)", borderTop: "1px solid var(--border)",
        display: "flex", justifyContent: "space-around",
        padding: "6px 4px calc(6px + env(safe-area-inset-bottom))",
      }}>
      {NAV_ITENS.map(({ href, rotulo, Icone }) => {
        const ativo = ehAtivo(href, path);
        const cor = ativo ? "var(--accent)" : "var(--muted)";
        return (
          <Link key={href} href={href}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: cor, padding: "4px 0" }}>
            <Icone size={20} weight={ativo ? "fill" : "regular"} aria-hidden />
            <span style={{ fontSize: "0.68rem", fontWeight: 600 }}>{rotulo}</span>
          </Link>
        );
      })}
    </nav>
  );
}
