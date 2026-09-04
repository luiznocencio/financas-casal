export type ItemOrcamento = {
  categoria_id: string;
  limiteCentavos: number;
  gastoCentavos: number;
  restanteCentavos: number;
  pctUsado: number;
};

export type ResumoOrcamento = {
  itens: ItemOrcamento[];
  totalOrcadoCentavos: number;
  totalGastoCentavos: number;
  reservaCentavos: number; // renda − total orçado (pode ser negativo = passou da renda)
};

// Orçamento em REAIS: cada categoria tem um limite em centavos.
export function resumoOrcamento(params: {
  rendaCentavos: number;
  budgets: { categoria_id: string; valor_centavos: number }[];
  gastoPorCategoria: Record<string, number>;
}): ResumoOrcamento {
  const itens: ItemOrcamento[] = params.budgets.map((b) => {
    const limiteCentavos = Math.max(0, b.valor_centavos);
    const gastoCentavos = params.gastoPorCategoria[b.categoria_id] ?? 0;
    return {
      categoria_id: b.categoria_id,
      limiteCentavos,
      gastoCentavos,
      restanteCentavos: limiteCentavos - gastoCentavos,
      pctUsado: limiteCentavos > 0 ? (gastoCentavos / limiteCentavos) * 100 : 0,
    };
  });
  const totalOrcadoCentavos = itens.reduce((s, i) => s + i.limiteCentavos, 0);
  const totalGastoCentavos = itens.reduce((s, i) => s + i.gastoCentavos, 0);
  return {
    itens,
    totalOrcadoCentavos,
    totalGastoCentavos,
    reservaCentavos: params.rendaCentavos - totalOrcadoCentavos,
  };
}
