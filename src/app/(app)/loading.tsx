// Mostrado na hora ao trocar de tela, enquanto os dados chegam do servidor —
// o menu/abas continuam respondendo e a navegação não parece "travada".
export default function Carregando() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6" aria-busy="true" aria-label="Carregando">
      <div className="h-7 w-40 animate-pulse rounded-md bg-[var(--surface-2)]" />
      <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="h-3 w-24 animate-pulse rounded bg-[var(--surface-2)]" />
        <div className="grid gap-2 sm:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-[var(--radius-sm)] bg-[var(--surface-2)]" />)}
        </div>
        <div className="h-28 animate-pulse rounded-[var(--radius-sm)] bg-[var(--surface-2)]" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="h-4 w-32 animate-pulse rounded bg-[var(--surface-2)]" />
            <div className="h-3 animate-pulse rounded bg-[var(--surface-2)]" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-[var(--surface-2)]" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-[var(--surface-2)]" />
          </div>
        ))}
      </div>
    </main>
  );
}
