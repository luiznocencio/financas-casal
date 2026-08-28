-- Assinaturas de Web Push por dispositivo (cada celular/navegador do casal).
-- Uma linha por endpoint do Push Service; escopada ao household via RLS.
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  criado_por uuid not null default auth.uid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_household_idx on push_subscriptions(household_id);

alter table push_subscriptions enable row level security;
create policy push_subscriptions_all on push_subscriptions for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());
