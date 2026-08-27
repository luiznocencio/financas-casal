-- Regras aprendidas: descrição normalizada -> categoria (+ nome preferido).
create table category_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  chave text not null,                 -- descrição normalizada (minúsculas, espaços colapsados)
  categoria_id uuid not null references categories(id) on delete cascade,
  descricao_preferida text,
  created_at timestamptz not null default now(),
  unique (household_id, chave)
);
create index category_rules_household_idx on category_rules(household_id);

alter table category_rules enable row level security;
create policy category_rules_all on category_rules for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());
