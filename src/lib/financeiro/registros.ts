import type { LinhaPlanejada } from "./planejar";

export type CtxRegistro = {
  householdId: string;
  criadoPor: string;
  origemIa: boolean;
  grupoImportacao?: string | null;
  recorrenteId?: string | null;
  contaPagarId?: string | null;
  receitaAgendadaId?: string | null;
};

/**
 * Monta os registros a inserir em `transactions` a partir das linhas planejadas
 * e do mapa competência -> invoice_id já resolvido (upsert de invoices).
 * Função pura: nenhuma chamada de rede/DB.
 */
export function mapearRegistros(
  linhas: LinhaPlanejada[],
  invoiceIdPorComp: Map<string, string>,
  ctx: CtxRegistro,
) {
  return linhas.map((linha) => {
    const chave = linha.invoiceCompetencia
      ? `${linha.invoiceCompetencia.ano}-${linha.invoiceCompetencia.mes}` : null;
    return {
      household_id: ctx.householdId,
      tipo: linha.tipo, valor_centavos: linha.valor_centavos,
      data_compra: linha.data_compra, categoria_id: linha.categoria_id,
      pessoa: linha.pessoa, account_id: linha.account_id, card_id: linha.card_id,
      invoice_id: chave ? invoiceIdPorComp.get(chave) ?? null : null,
      grupo_parcela: linha.grupo_parcela, parcela_n: linha.parcela_n,
      total_parcelas: linha.total_parcelas, descricao: linha.descricao,
      criado_por: ctx.criadoPor, origem_ia: ctx.origemIa,
      grupo_importacao: ctx.grupoImportacao ?? null,
      recorrente_id: ctx.recorrenteId ?? null,
      conta_pagar_id: ctx.contaPagarId ?? null,
      receita_agendada_id: ctx.receitaAgendadaId ?? null,
    };
  });
}
