import { Competencia, competenciaDaCompra, proximaCompetencia } from "./fatura";

export type Parcela = {
  parcela_n: number;
  total_parcelas: number;
  valor_centavos: number;
  competencia: Competencia;
};

export function gerarParcelas(p: {
  valorTotalCentavos: number;
  totalParcelas: number;
  dataCompra: Date;
  diaFechamento: number;
}): Parcela[] {
  const n = Math.max(1, Math.floor(p.totalParcelas));
  const base = Math.floor(p.valorTotalCentavos / n);
  const resto = p.valorTotalCentavos - base * n;

  let comp = competenciaDaCompra(p.dataCompra, p.diaFechamento);
  const parcelas: Parcela[] = [];
  for (let i = 0; i < n; i++) {
    parcelas.push({
      parcela_n: i + 1,
      total_parcelas: n,
      valor_centavos: base + (i === 0 ? resto : 0),
      competencia: comp,
    });
    comp = proximaCompetencia(comp);
  }
  return parcelas;
}
