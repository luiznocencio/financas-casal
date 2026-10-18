-- Cartão principal passa a ser de cada pessoa (não mais um por lar): cada membro
-- escolhe o seu, que vem pré-selecionado no lançamento manual dele.
alter table members add column cartao_principal_id uuid references cards(id) on delete set null;

-- leva o principal antigo pro titular do cartão; sem titular do lar, vale pros dois
update members m
set cartao_principal_id = c.id
from cards c
where c.principal and c.household_id = m.household_id
  and (c.titular = m.nome
       or not exists (select 1 from members m2 where m2.household_id = c.household_id and m2.nome = c.titular));

drop index if exists cards_um_principal_por_lar;
alter table cards drop column principal;
