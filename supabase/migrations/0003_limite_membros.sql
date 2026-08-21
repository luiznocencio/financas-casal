-- Endurece o convite: um lar do casal tem no máximo 2 membros.
-- Sem isso, qualquer usuário que descubra o invite_code poderia se somar ao lar.
create or replace function checa_limite_membros() returns trigger
language plpgsql as $$
begin
  if (select count(*) from members where household_id = new.household_id) >= 2 then
    raise exception 'lar já atingiu o limite de 2 membros';
  end if;
  return new;
end $$;

drop trigger if exists membros_max_2 on members;
create trigger membros_max_2 before insert on members
  for each row execute function checa_limite_membros();
