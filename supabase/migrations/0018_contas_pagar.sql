-- Contas a pagar (água, energia, internet...): têm vencimento e valor VARIÁVEL,
-- então o valor é informado ao marcar como pago (diferente do gasto fixo, que
-- tem valor fixo e é gerado automático). Ao pagar, vira uma despesa de verdade.
create table contas_pagar (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  descricao text not null,
  categoria_id uuid references categories(id) on delete set null,
  pessoa text not null default 'conjunto',
  dia_vencimento int not null check (dia_vencimento between 1 and 31),
  valor_estimado_centavos int,
  account_id uuid references accounts(id) on delete cascade,
  card_id uuid references cards(id) on delete cascade,
  recorrencia text not null default 'mensal' check (recorrencia in ('unica','mensal')),
  data_fim date,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create index contas_pagar_household_idx on contas_pagar(household_id);

alter table contas_pagar enable row level security;
create policy contas_pagar_all on contas_pagar for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());

-- liga o lançamento pago à conta (pra saber que já foi paga no mês)
alter table transactions add column conta_pagar_id uuid references contas_pagar(id) on delete set null;
create index transactions_conta_pagar_idx on transactions(conta_pagar_id);
