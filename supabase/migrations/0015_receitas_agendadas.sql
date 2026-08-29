-- Receitas agendadas / "a receber": o que se tem a receber, quando, pra onde
-- (conta destino) e com qual recorrência. Ao marcar "recebi", vira uma receita
-- de verdade na conta; se for mensal, a data avança pro mês seguinte.
create table receitas_agendadas (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  descricao text not null,
  valor_centavos int not null,
  account_id uuid not null references accounts(id) on delete cascade,
  pessoa text not null default 'conjunto',
  data_prevista date not null,
  recorrencia text not null default 'unica' check (recorrencia in ('unica','mensal')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create index receitas_agendadas_household_idx on receitas_agendadas(household_id);

alter table receitas_agendadas enable row level security;
create policy receitas_agendadas_all on receitas_agendadas for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());
