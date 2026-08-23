-- Fase 3: metas/reservas com aportes (histórico de contribuições).
create table goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  nome text not null,
  valor_alvo_centavos int not null check (valor_alvo_centavos > 0),
  data_alvo date,
  created_at timestamptz not null default now()
);
create index goals_household_idx on goals(household_id);

create table goal_contributions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  goal_id uuid not null references goals(id) on delete cascade,
  valor_centavos int not null check (valor_centavos <> 0),  -- negativo = retirada
  data date not null default current_date,
  descricao text,
  created_at timestamptz not null default now()
);
create index goal_contributions_goal_idx on goal_contributions(goal_id);
create index goal_contributions_household_idx on goal_contributions(household_id);

alter table goals enable row level security;
alter table goal_contributions enable row level security;
create policy goals_all on goals for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());
create policy goal_contributions_all on goal_contributions for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());
