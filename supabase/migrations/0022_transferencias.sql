-- Transferência entre contas: um par de lançamentos ligado por grupo_transferencia.
-- Saída na origem (tipo 'transferencia') e entrada no destino ('transferencia_entrada').
-- Nenhum dos dois conta como despesa/receita nas estatísticas do mês.
alter table transactions drop constraint if exists transactions_tipo_check;
alter table transactions add constraint transactions_tipo_check
  check (tipo in ('despesa','receita','transferencia','transferencia_entrada'));
alter table transactions add column if not exists grupo_transferencia uuid;
create index if not exists transactions_grupo_transferencia_idx on transactions(grupo_transferencia);
