import Link from "next/link";
import { Repeat, Receipt, CreditCard, HandCoins, Target } from "@phosphor-icons/react/dist/ssr";

export type AbaPlanejamento = "fixos" | "contas" | "parcelas" | "receber" | "metas";

const ABAS = [
  { id: "fixos", rotulo: "Fixos", Icone: Repeat },
  { id: "contas", rotulo: "A pagar", Icone: Receipt },
  { id: "parcelas", rotulo: "Parcelas", Icone: CreditCard },
  { id: "receber", rotulo: "A receber", Icone: HandCoins },
  { id: "metas", rotulo: "Metas", Icone: Target },
] satisfies { id: AbaPlanejamento; rotulo: string; Icone: typeof Target }[];

// Barra de abas do Planejamento — cada aba é um link ?aba=, servidor decide o conteúdo.
export function PlanejamentoTabs({ ativa }: { ativa: AbaPlanejamento }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {ABAS.map((a) => {
        const on = a.id === ativa;
        return (
          <Link
            key={a.id}
            href={`/planejamento?aba=${a.id}`}
            aria-current={on ? "page" : undefined}
            className="flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors"
            style={{
              borderColor: on ? "var(--accent)" : "var(--border)",
              background: on ? "var(--accent)" : "var(--surface)",
              color: on ? "#fff" : "var(--muted)",
            }}
          >
            <a.Icone size={16} weight={on ? "fill" : "regular"} />
            {a.rotulo}
          </Link>
        );
      })}
    </div>
  );
}
