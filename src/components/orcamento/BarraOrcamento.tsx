import { Money } from "@/components/ui/Money";

// Barra de status de gasto de uma categoria (gasto x limite). Usada no Orçamento
// e no Extrato (ao filtrar por uma categoria de orçamento).
export function BarraOrcamento({
  gastoCentavos, limiteCentavos, cor,
}: { gastoCentavos: number; limiteCentavos: number; cor: string }) {
  const usado = limiteCentavos > 0 ? (gastoCentavos / limiteCentavos) * 100 : 0;
  const corBarra = usado > 100 ? "var(--negativo)" : usado > 85 ? "var(--alerta)" : cor;
  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, usado)}%`, background: corBarra }} />
      </div>
      <div className="mt-2 flex justify-between text-sm text-[var(--muted)]">
        <span>Gasto <Money centavos={gastoCentavos} tamanho="sm" /> de <Money centavos={limiteCentavos} tamanho="sm" /></span>
        <span>{limiteCentavos > 0 ? <>Resta <Money centavos={limiteCentavos - gastoCentavos} tamanho="sm" sinal /></> : "sem limite"}</span>
      </div>
    </div>
  );
}
