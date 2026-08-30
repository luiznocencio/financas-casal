import { House, CreditCard, Wallet, Receipt, ChartPieSlice, Target, CalendarCheck } from "@phosphor-icons/react";

// Itens de navegação usados na TabBar (mobile) e na Sidebar (desktop).
export const NAV_ITENS = [
  { href: "/", rotulo: "Início", Icone: House },
  { href: "/cartoes", rotulo: "Cartões", Icone: CreditCard },
  { href: "/contas", rotulo: "Contas", Icone: Wallet },
  { href: "/lancamentos", rotulo: "Extrato", Icone: Receipt },
  { href: "/planejamento", rotulo: "Planejar", Icone: CalendarCheck },
  { href: "/orcamento", rotulo: "Orçamento", Icone: ChartPieSlice },
  { href: "/metas", rotulo: "Metas", Icone: Target },
] as const;

export function ehAtivo(href: string, path: string): boolean {
  return href === "/" ? path === "/" : path.startsWith(href);
}
