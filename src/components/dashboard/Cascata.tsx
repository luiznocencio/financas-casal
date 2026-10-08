import { centavosParaReais } from "@/lib/financeiro/dinheiro";

export type PassoCascata = {
  rotulo: string;
  valor: number;          // passo: variação (+/−); total: valor absoluto
  total?: boolean;        // barra parte do zero (saldo inicial, resultado)
  cor?: string;
};

// Gráfico em cascata (waterfall): cada passo sobe ou desce a partir de onde o
// anterior parou; os totais partem do zero. Só CSS — renderiza no servidor.
export function Cascata({ passos, altura = 120 }: { passos: PassoCascata[]; altura?: number }) {
  // pontos (início, fim) de cada barra: o passo parte de onde o anterior parou
  const barras = passos.reduce<(PassoCascata & { de: number; ate: number })[]>((acc, p) => {
    const corrente = acc.length ? acc[acc.length - 1].ate : 0;
    const de = p.total ? 0 : corrente;
    return [...acc, { ...p, de, ate: p.total ? p.valor : corrente + p.valor }];
  }, []);
  const todos = barras.flatMap((b) => [b.de, b.ate]);
  const max = Math.max(0, ...todos);
  const min = Math.min(0, ...todos);
  const faixa = max - min || 1;
  const y = (v: number) => ((max - v) / faixa) * altura;
  const zero = y(0);

  // total: valor com sinal só se negativo; passo: sempre com +/−
  const fmt = (b: (typeof barras)[number]) => {
    const abs = centavosParaReais(Math.abs(b.valor));
    return b.valor < 0 ? `−${abs}` : b.total ? abs : `+${abs}`;
  };

  return (
    <div className="flex items-end gap-1.5 sm:gap-3" role="img"
      aria-label={barras.map((b) => `${b.rotulo}: ${fmt(b)}`).join("; ")}>
      {barras.map((b, i) => {
        const topo = y(Math.max(b.de, b.ate));
        const h = Math.max(2, Math.abs(y(b.de) - y(b.ate)));
        const cor = b.cor ?? (b.total ? "var(--muted)" : b.valor >= 0 ? "var(--positivo)" : "var(--negativo)");
        return (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="relative w-full" style={{ height: altura }}>
              {/* linha do zero quando há valores negativos */}
              {min < 0 && <div className="absolute inset-x-0 border-t border-dashed border-[var(--border)]" style={{ top: zero }} />}
              <div className="absolute inset-x-1 rounded-sm sm:inset-x-2"
                style={{ top: topo, height: h, background: cor, opacity: b.total ? 1 : 0.75 }} />
            </div>
            <span className="w-full truncate text-center text-[11px] leading-tight text-[var(--muted)]" title={b.rotulo}>{b.rotulo}</span>
            <span className="mono w-full truncate text-center text-[11px] font-semibold leading-tight"
              style={{ color: b.total ? cor : "var(--text)" }}>{fmt(b)}</span>
          </div>
        );
      })}
    </div>
  );
}
