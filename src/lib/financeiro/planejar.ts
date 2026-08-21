import { randomUUID } from "crypto";
import { gerarParcelas } from "./parcelas";
import type { Competencia } from "./fatura";
import type { NovoLancamento } from "./tipos";

export type LinhaPlanejada = {
  tipo: NovoLancamento["tipo"];
  valor_centavos: number;
  data_compra: string;
  categoria_id: string | null;
  pessoa: string;
  account_id: string | null;
  card_id: string | null;
  grupo_parcela: string | null;
  parcela_n: number;
  total_parcelas: number;
  descricao: string | null;
  invoiceCompetencia: Competencia | null; // null = lançamento em conta
};

/** Planeja as linhas a inserir. diaFechamento só é usado quando é cartão. */
export function planejarLinhas(l: NovoLancamento, diaFechamento: number | null): LinhaPlanejada[] {
  const comum = {
    tipo: l.tipo, categoria_id: l.categoria_id, pessoa: l.pessoa,
    account_id: l.account_id, card_id: l.card_id, descricao: l.descricao,
    data_compra: l.data_compra,
  };

  if (l.card_id && diaFechamento != null) {
    const grupo = l.total_parcelas > 1 ? randomUUID() : null;
    const parcelas = gerarParcelas({
      valorTotalCentavos: l.valor_centavos,
      totalParcelas: l.total_parcelas,
      dataCompra: new Date(l.data_compra + "T12:00:00"),
      diaFechamento,
    });
    return parcelas.map((p) => ({
      ...comum,
      valor_centavos: p.valor_centavos,
      grupo_parcela: grupo,
      parcela_n: p.parcela_n,
      total_parcelas: p.total_parcelas,
      invoiceCompetencia: p.competencia,
    }));
  }

  // lançamento em conta (à vista)
  return [{
    ...comum,
    valor_centavos: l.valor_centavos,
    grupo_parcela: null, parcela_n: 1, total_parcelas: 1,
    invoiceCompetencia: null,
  }];
}
