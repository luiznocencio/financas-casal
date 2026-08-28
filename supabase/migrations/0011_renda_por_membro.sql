-- Renda por pessoa: cada membro informa a sua; o orçamento soma as duas.
alter table members add column renda_mensal_centavos int not null default 0;

-- ponto de partida: joga a renda que estava no household para o dono (ajustável na tela)
update members m
set renda_mensal_centavos = h.renda_mensal_centavos
from households h
where h.id = m.household_id and m.papel = 'dono' and h.renda_mensal_centavos > 0;

-- membros do mesmo lar podem editar a renda (a própria e a do parceiro)
create policy members_update on members for update
  using (household_id = current_household_id())
  with check (household_id = current_household_id());
