-- Resumo do mês em uma frase: os números vêm do app e a IA só redige. Guarda o
-- texto por (casa, mês) com o hash dos números — só chama a IA de novo quando
-- os números mudam.
create table resumos_mes (
  household_id uuid not null references households(id) on delete cascade,
  mes text not null,              -- 'YYYY-MM'
  hash text not null,
  texto text not null,
  updated_at timestamptz not null default now(),
  primary key (household_id, mes)
);
alter table resumos_mes enable row level security;
create policy resumos_mes_all on resumos_mes for all
  using (household_id = current_household_id())
  with check (household_id = current_household_id());

-- Avisos já enviados (cron), pra não repetir o mesmo aviso todo dia.
-- chave ex.: 'orc:<categoria>:2026-10:estourou'. Só o service role acessa.
create table alertas_enviados (
  household_id uuid not null references households(id) on delete cascade,
  chave text not null,
  created_at timestamptz not null default now(),
  primary key (household_id, chave)
);
alter table alertas_enviados enable row level security;
