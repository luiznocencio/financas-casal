type TxResumo = {
  tipo: "despesa" | "receita" | "transferencia";
  valor_centavos: number;
  pessoa: string;
  categoria_id: string | null;
  data_compra: string; // yyyy-mm-dd
};

export function resumoDoMes(
  txs: TxResumo[],
  ref: { ano: number; mes: number },
): {
  totalDespesas: number;
  totalReceitas: number;
  porPessoa: Record<string, number>;
  porCategoria: Record<string, number>;
} {
  const doMes = txs.filter((t) => {
    const [ano, mes] = t.data_compra.split("-").map(Number);
    return ano === ref.ano && mes === ref.mes;
  });
  const porPessoa: Record<string, number> = {};
  const porCategoria: Record<string, number> = {};
  let totalDespesas = 0, totalReceitas = 0;
  for (const t of doMes) {
    if (t.tipo === "receita") { totalReceitas += t.valor_centavos; continue; }
    if (t.tipo === "despesa") {
      totalDespesas += t.valor_centavos;
      porPessoa[t.pessoa] = (porPessoa[t.pessoa] ?? 0) + t.valor_centavos;
      if (t.categoria_id) porCategoria[t.categoria_id] = (porCategoria[t.categoria_id] ?? 0) + t.valor_centavos;
    }
  }
  return { totalDespesas, totalReceitas, porPessoa, porCategoria };
}
