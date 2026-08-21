export function limiteCategoria(rendaCentavos: number, percentual: number): number {
  return Math.round((rendaCentavos * percentual) / 100);
}

export type ItemOrcamento = {
  categoria_id: string;
  percentual: number;
  limiteCentavos: number;
  gastoCentavos: number;
  restanteCentavos: number;
  pctUsado: number;
};

export type ResumoOrcamento = {
  itens: ItemOrcamento[];
  totalPercentual: number;
  totalOrcadoCentavos: number;
  totalGastoCentavos: number;
  naoAlocadoPercentual: number;
  reservaCentavos: number;
};

export function resumoOrcamento(params: {
  rendaCentavos: number;
  budgets: { categoria_id: string; percentual: number }[];
  gastoPorCategoria: Record<string, number>;
}): ResumoOrcamento {
  const itens: ItemOrcamento[] = params.budgets.map((b) => {
    const limiteCentavos = limiteCategoria(params.rendaCentavos, b.percentual);
    const gastoCentavos = params.gastoPorCategoria[b.categoria_id] ?? 0;
    return {
      categoria_id: b.categoria_id,
      percentual: b.percentual,
      limiteCentavos,
      gastoCentavos,
      restanteCentavos: limiteCentavos - gastoCentavos,
      pctUsado: limiteCentavos > 0 ? (gastoCentavos / limiteCentavos) * 100 : 0,
    };
  });
  const totalPercentual = params.budgets.reduce((s, b) => s + b.percentual, 0);
  const totalOrcadoCentavos = itens.reduce((s, i) => s + i.limiteCentavos, 0);
  const totalGastoCentavos = itens.reduce((s, i) => s + i.gastoCentavos, 0);
  return {
    itens,
    totalPercentual,
    totalOrcadoCentavos,
    totalGastoCentavos,
    naoAlocadoPercentual: Math.max(0, 100 - totalPercentual),
    reservaCentavos: params.rendaCentavos - totalOrcadoCentavos,
  };
}
