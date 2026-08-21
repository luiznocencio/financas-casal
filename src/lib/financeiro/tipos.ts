export type NovoLancamento = {
  tipo: "despesa" | "receita" | "transferencia";
  valor_centavos: number;
  data_compra: string;            // ISO yyyy-mm-dd
  categoria_id: string | null;
  pessoa: string;
  account_id: string | null;
  card_id: string | null;
  total_parcelas: number;         // 1 = à vista
  descricao: string | null;
  origem_ia?: boolean;
};
