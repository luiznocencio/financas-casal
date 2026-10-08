import { Money } from "@/components/ui/Money";
import { centavosParaReais } from "@/lib/financeiro/dinheiro";
import { estadoCategoria, type EstadoOrc } from "@/lib/financeiro/projecao";

// Barra de status de gasto de uma categoria (gasto x limite). Usada no Orçamento
// e no Extrato (ao filtrar por uma categoria de orçamento). Com `aCairCentavos`,
// mostra também o que ainda vai cair no mês (fixos e contas) num trecho mais
// claro, e em quanto o mês fecha.
export function BarraOrcamento({
  gastoCentavos, limiteCentavos, cor, aCairCentavos = 0,
}: { gastoCentavos: number; limiteCentavos: number; cor: string; aCairCentavos?: number }) {
  const { estado } = estadoCategoria(limiteCentavos, gastoCentavos, aCairCentavos);
  const projetado = gastoCentavos + aCairCentavos;
  // escala: o maior entre limite e projetado, pra o excesso aparecer na barra
  const escala = Math.max(limiteCentavos, projetado, 1);
  const pctGasto = limiteCentavos > 0 ? (gastoCentavos / escala) * 100 : 0;
  const pctACair = limiteCentavos > 0 ? (aCairCentavos / escala) * 100 : 0;
  const pctLimite = (limiteCentavos / escala) * 100;
  const corBarra = estado === "estourou" ? "var(--negativo)"
    : estado === "vai_estourar" || estado === "atencao" ? "var(--alerta)" : cor;
  return (
    <div>
      <div className="relative h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div className="absolute inset-y-0 left-0 rounded-l-full" style={{ width: `${pctGasto}%`, background: corBarra }} />
        {pctACair > 0 && (
          <div className="absolute inset-y-0" title="Ainda vai cair no mês"
            style={{
              left: `${pctGasto}%`, width: `${pctACair}%`,
              background: `repeating-linear-gradient(135deg, ${corBarra} 0 3px, transparent 3px 6px)`, opacity: 0.6,
            }} />
        )}
        {/* marca do limite quando a barra passa dele */}
        {limiteCentavos > 0 && pctLimite < 100 && (
          <div className="absolute inset-y-0 w-0.5 bg-[var(--text)]" style={{ left: `${pctLimite}%` }} />
        )}
      </div>
      <div className="mt-2 flex justify-between gap-2 text-sm text-[var(--muted)]">
        <span>Gasto <Money centavos={gastoCentavos} tamanho="sm" /> de <Money centavos={limiteCentavos} tamanho="sm" /></span>
        <span>{limiteCentavos > 0 ? <>Resta <Money centavos={limiteCentavos - gastoCentavos} tamanho="sm" sinal /></> : "sem limite"}</span>
      </div>
      {aCairCentavos > 0 && (
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          + {centavosParaReais(aCairCentavos)} ainda vai cair (fixos e contas) · fecha em{" "}
          <strong className="mono" style={{ color: limiteCentavos > 0 && projetado > limiteCentavos ? "var(--alerta)" : "var(--text)" }}>
            {centavosParaReais(projetado)}
          </strong>
        </p>
      )}
    </div>
  );
}

// Selo de status em texto (não só cor): estourou / vai passar / atenção.
export function SeloOrcamento({ estado, excesso }: { estado: EstadoOrc; excesso: number }) {
  if (estado === "ok") return null;
  const cor = estado === "estourou" ? "var(--negativo)" : "var(--alerta)";
  const texto = estado === "estourou" ? `Estourou em ${centavosParaReais(excesso)}`
    : estado === "vai_estourar" ? `Vai passar ${centavosParaReais(excesso)}` : "Atenção · 90%";
  return (
    <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color: cor, background: `color-mix(in srgb, ${cor} 12%, transparent)` }}>
      {texto}
    </span>
  );
}
