-- Gastos recorrentes (contas fixas): entram no mapeamento todo mês, dizendo
-- de onde sai o dinheiro. O lançamento gerado guarda recorrente_id para (a)
-- não relançar 2x no mesmo mês e (b) casar/dedup com a fatura importada.
create table recorrentes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  descricao text not null,
  valor_centavos int not null,
  categoria_id uuid references categories(id) on delete set null,
  pessoa text not null default 'conjunto',
  dia int not null check (dia between 1 and 31),
  account_id uuid references accounts(id) on delete cascade,
  card_id uuid references cards(id) on delete cascade,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create index recorrentes_household_idx on recorrentes(household_id);

alter table recorrentes enable row level security;
create policy recorrentes_all on recorrentes for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());

alter table transactions add column recorrente_id uuid references recorrentes(id) on delete set null;
create index transactions_recorrente_idx on transactions(recorrente_id);
