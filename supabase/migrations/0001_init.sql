-- ==== HOUSEHOLD (o lar do casal) ====
create table households (
  id uuid primary key default gen_random_uuid(),
  nome text not null default 'Nosso lar',
  invite_code text not null unique default encode(gen_random_bytes(4), 'hex'),
  created_at timestamptz not null default now()
);

create table members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  nome text not null,
  papel text not null default 'membro' check (papel in ('membro','dono'))
);
create index members_household_idx on members(household_id);

-- Função: o household do usuário logado
create or replace function current_household_id() returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from members where user_id = auth.uid()
$$;

-- ==== CONTAS ====
create table accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  nome text not null,
  tipo text not null default 'corrente' check (tipo in ('corrente','dinheiro','poupanca')),
  saldo_inicial_centavos int not null default 0,
  created_at timestamptz not null default now()
);
create index accounts_household_idx on accounts(household_id);

-- ==== CARTÕES ====
create table cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  nome text not null,
  bandeira text,
  limite_centavos int not null default 0,
  dia_fechamento int not null check (dia_fechamento between 1 and 31),
  dia_vencimento int not null check (dia_vencimento between 1 and 31),
  titular text,
  created_at timestamptz not null default now()
);
create index cards_household_idx on cards(household_id);

-- ==== CATEGORIAS ====
create table categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  nome text not null,
  tipo text not null default 'despesa' check (tipo in ('despesa','receita')),
  cor text not null default '#6b7280',
  icone text,
  created_at timestamptz not null default now()
);
create index categories_household_idx on categories(household_id);

-- ==== FATURAS (uma por cartão por competência) ====
create table invoices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  card_id uuid not null references cards(id) on delete cascade,
  competencia_ano int not null,
  competencia_mes int not null check (competencia_mes between 1 and 12),
  status text not null default 'aberta' check (status in ('aberta','fechada','paga')),
  created_at timestamptz not null default now(),
  unique (card_id, competencia_ano, competencia_mes)
);
create index invoices_household_idx on invoices(household_id);

-- ==== TRANSAÇÕES (o ledger) ====
create table transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  tipo text not null check (tipo in ('despesa','receita','transferencia')),
  valor_centavos int not null check (valor_centavos > 0),
  data_compra date not null,
  categoria_id uuid references categories(id) on delete set null,
  pessoa text not null,                        -- nome do membro ou 'conjunto'
  account_id uuid references accounts(id) on delete cascade,
  card_id uuid references cards(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete set null,
  grupo_parcela uuid,                          -- agrupa parcelas da mesma compra
  parcela_n int not null default 1,
  total_parcelas int not null default 1,
  descricao text,
  paga boolean not null default false,         -- parcela/fatura já quitada
  criado_por uuid references auth.users(id),
  origem_ia boolean not null default false,
  created_at timestamptz not null default now(),
  -- exatamente uma origem: conta OU cartão
  constraint origem_unica check (
    (account_id is not null and card_id is null) or
    (account_id is null and card_id is not null)
  )
);
create index transactions_household_idx on transactions(household_id);
create index transactions_data_idx on transactions(household_id, data_compra);
create index transactions_invoice_idx on transactions(invoice_id);

-- ==== RLS ====
alter table households enable row level security;
alter table members enable row level security;
alter table accounts enable row level security;
alter table cards enable row level security;
alter table categories enable row level security;
alter table invoices enable row level security;
alter table transactions enable row level security;

-- households: membro enxerga o próprio lar; insert liberado para o bootstrap
create policy household_select on households for select
  using (id = current_household_id());
create policy household_insert on households for insert with check (true);
create policy household_update on households for update
  using (id = current_household_id());

-- members: enxerga membros do mesmo lar; insere a si mesmo no bootstrap
create policy members_select on members for select
  using (household_id = current_household_id());
create policy members_insert_self on members for insert
  with check (user_id = auth.uid());

-- tabelas de dados: tudo do próprio household
create policy accounts_all on accounts for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());
create policy cards_all on cards for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());
create policy categories_all on categories for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());
create policy invoices_all on invoices for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());
create policy transactions_all on transactions for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());
