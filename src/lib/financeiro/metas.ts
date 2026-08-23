export type MetaCalculada = {
  guardadoCentavos: number;
  restanteCentavos: number;
  pctConcluido: number;
  concluida: boolean;
};

export function calcularMeta(
  alvoCentavos: number,
  aportes: { valor_centavos: number }[],
): MetaCalculada {
  const guardado = aportes.reduce((s, a) => s + a.valor_centavos, 0);
  const restante = Math.max(0, alvoCentavos - guardado);
  const pct = alvoCentavos > 0 ? Math.min(100, Math.max(0, (guardado / alvoCentavos) * 100)) : 0;
  return {
    guardadoCentavos: guardado,
    restanteCentavos: restante,
    pctConcluido: pct,
    concluida: guardado >= alvoCentavos,
  };
}

export function totaisMetas(
  goals: { id: string; valor_alvo_centavos: number }[],
  aportesPorGoal: Record<string, { valor_centavos: number }[]>,
): { totalAlvoCentavos: number; totalGuardadoCentavos: number } {
  let totalAlvoCentavos = 0;
  let totalGuardadoCentavos = 0;
  for (const g of goals) {
    totalAlvoCentavos += g.valor_alvo_centavos;
    totalGuardadoCentavos += (aportesPorGoal[g.id] ?? []).reduce((s, a) => s + a.valor_centavos, 0);
  }
  return { totalAlvoCentavos, totalGuardadoCentavos };
}
