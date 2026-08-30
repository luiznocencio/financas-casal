import Link from "next/link";
import { PlanejamentoTabs, type AbaPlanejamento } from "@/components/planejamento/PlanejamentoTabs";
import { SecaoFixos } from "@/components/planejamento/SecaoFixos";
import { SecaoContasPagar } from "@/components/planejamento/SecaoContasPagar";
import { SecaoAReceber } from "@/components/planejamento/SecaoAReceber";

const ABAS_VALIDAS = new Set(["fixos", "contas", "receber"]);

export default async function PlanejamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const sp = await searchParams;
  const aba: AbaPlanejamento = ABAS_VALIDAS.has(sp.aba ?? "") ? (sp.aba as AbaPlanejamento) : "fixos";

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-[var(--text)]">Planejamento</h1>
          <Link href="/lancamentos" className="text-sm text-[var(--accent)]">Extrato</Link>
        </div>
        <p className="text-sm text-[var(--muted)]">Contas fixas, contas a pagar e o que você tem a receber — tudo do mês num lugar só.</p>
      </header>

      <PlanejamentoTabs ativa={aba} />

      {aba === "fixos" && <SecaoFixos />}
      {aba === "contas" && <SecaoContasPagar />}
      {aba === "receber" && <SecaoAReceber />}
    </main>
  );
}
