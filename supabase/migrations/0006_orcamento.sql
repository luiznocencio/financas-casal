-- Fase 2: orçamento por % da renda mensal do casal.
alter table households add column renda_mensal_centavos int not null default 0;

create table budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  categoria_id uuid not null references categories(id) on delete cascade,
  percentual numeric(5,2) not null check (percentual >= 0 and percentual <= 100),
  created_at timestamptz not null default now(),
  unique (household_id, categoria_id)
);
create index budgets_household_idx on budgets(household_id);

alter table budgets enable row level security;
create policy budgets_all on budgets for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());
