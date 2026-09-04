-- Liga a receita lançada de volta à receita agendada que a originou, pra saber
-- o que já foi "recebido" naquele mês (paralelo ao conta_pagar_id das contas).
alter table transactions
  add column if not exists receita_agendada_id uuid references receitas_agendadas(id) on delete set null;
create index if not exists transactions_receita_agendada_idx on transactions(receita_agendada_id);
