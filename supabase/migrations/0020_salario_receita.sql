-- Marca receitas agendadas que representam o salário fixo do orçamento,
-- pra sincronizar valor com a renda do membro e evitar duplicar ao puxar de novo.
alter table receitas_agendadas
  add column if not exists origem_salario boolean not null default false;
