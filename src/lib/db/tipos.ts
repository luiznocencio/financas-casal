export type Pessoa = string; // nome do membro ou 'conjunto'
export type TipoTransacao = "despesa" | "receita" | "transferencia";

export type Household = { id: string; nome: string; invite_code: string; renda_mensal_centavos: number };
export type Budget = { id: string; household_id: string; categoria_id: string; percentual: number };
export type Goal = { id: string; household_id: string; nome: string; valor_alvo_centavos: number; data_alvo: string | null };
export type GoalContribution = { id: string; household_id: string; goal_id: string; valor_centavos: number; data: string; descricao: string | null };
export type CategoryRule = { id: string; household_id: string; chave: string; categoria_id: string; descricao_preferida: string | null };
export type Member = { user_id: string; household_id: string; nome: string; papel: "membro" | "dono" };
export type Account = { id: string; household_id: string; nome: string; tipo: "corrente" | "dinheiro" | "poupanca"; saldo_inicial_centavos: number; titular: string | null };
export type Card = { id: string; household_id: string; nome: string; bandeira: string | null; limite_centavos: number; dia_fechamento: number; dia_vencimento: number; titular: string | null };
export type Category = { id: string; household_id: string; nome: string; tipo: "despesa" | "receita"; cor: string; icone: string | null };
export type Invoice = { id: string; household_id: string; card_id: string; competencia_ano: number; competencia_mes: number; status: "aberta" | "fechada" | "paga" };
export type Transaction = {
  id: string; household_id: string; tipo: TipoTransacao; valor_centavos: number;
  data_compra: string; categoria_id: string | null; pessoa: Pessoa;
  account_id: string | null; card_id: string | null; invoice_id: string | null;
  grupo_parcela: string | null; parcela_n: number; total_parcelas: number;
  descricao: string | null; paga: boolean; origem_ia: boolean;
  grupo_importacao: string | null;
};
