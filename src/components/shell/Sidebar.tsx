"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITENS, ehAtivo } from "./nav";
import { Marca } from "@/components/ui/Marca";

// Navegação lateral do desktop (no mobile some; lá vale a TabBar de baixo).
export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-1 border-r border-[var(--border)] bg-[var(--surface)] px-3 py-5 lg:flex">
      <Link href="/" className="mb-4 flex items-center gap-2 px-3">
        <Marca size={30} />
        <span className="font-semibold text-[var(--text)]">Finanças</span>
      </Link>
      {NAV_ITENS.map(({ href, rotulo, Icone }) => {
        const ativo = ehAtivo(href, path);
        return (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-sm transition-colors"
            style={{
              background: ativo ? "var(--accent-weak)" : "transparent",
              color: ativo ? "var(--accent)" : "var(--text)",
              fontWeight: ativo ? 600 : 500,
            }}
          >
            <Icone size={20} weight={ativo ? "fill" : "regular"} aria-hidden />
            {rotulo}
          </Link>
        );
      })}
    </aside>
  );
}
