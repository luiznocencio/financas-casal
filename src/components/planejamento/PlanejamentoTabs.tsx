import Link from "next/link";

export type AbaPlanejamento = "fixos" | "contas" | "receber" | "metas";

const ABAS: { id: AbaPlanejamento; rotulo: string }[] = [
  { id: "fixos", rotulo: "Gastos fixos" },
  { id: "contas", rotulo: "Contas a pagar" },
  { id: "receber", rotulo: "A receber" },
  { id: "metas", rotulo: "Metas" },
];

// Barra de abas do Planejamento — cada aba é um link ?aba=, servidor decide o conteúdo.
export function PlanejamentoTabs({ ativa }: { ativa: AbaPlanejamento }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)]">
      {ABAS.map((a) => {
        const on = a.id === ativa;
        return (
          <Link
            key={a.id}
            href={`/planejamento?aba=${a.id}`}
            aria-current={on ? "page" : undefined}
            className="-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors"
            style={{
              borderColor: on ? "var(--accent)" : "transparent",
              color: on ? "var(--text)" : "var(--muted)",
            }}
          >
            {a.rotulo}
          </Link>
        );
      })}
    </div>
  );
}
