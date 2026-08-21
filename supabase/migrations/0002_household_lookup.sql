-- Permite que um usuário AINDA NÃO membro descubra o household pelo invite_code.
-- A policy household_select filtra por current_household_id(), que é NULL para
-- quem não é membro — então um SELECT direto nunca acha o lar do parceiro.
-- Esta função security definer roda como owner (ignora RLS) e devolve APENAS o
-- id quando o invite_code bate exatamente (o código é o segredo de convite).
create or replace function household_id_por_invite(code text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from households where invite_code = code
$$;

revoke all on function household_id_por_invite(text) from public;
grant execute on function household_id_por_invite(text) to anon, authenticated;
