-- Liga um lançamento a uma meta (aporte que sai de uma conta). O dinheiro
-- guardado vira uma transferência na conta escolhida, ligada por goal_id.
alter table transactions
  add column if not exists goal_id uuid references goals(id) on delete set null;
create index if not exists transactions_goal_idx on transactions(goal_id);
