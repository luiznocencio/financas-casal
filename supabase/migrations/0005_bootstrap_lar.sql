-- Cria OU entra num lar de forma atômica, ignorando RLS com segurança.
-- O INSERT do household via cliente RLS falha ("new row violates row-level
-- security policy for table households") porque quem ainda não é membro não
-- passa nas policies (RETURNING sob RLS). security definer roda como owner.
create or replace function bootstrap_lar(
  p_invite_code text,
  p_nome_membro text,
  p_nome_lar text
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_hh_id uuid;
  v_invite text;
  v_member members;
  v_criando boolean := (p_invite_code is null or p_invite_code = '');
begin
  if v_uid is null then
    raise exception 'não autenticado';
  end if;

  select * into v_member from members where user_id = v_uid;
  if found then
    select invite_code into v_invite from households where id = v_member.household_id;
    return json_build_object('member', row_to_json(v_member), 'invite_code', v_invite, 'ja_membro', true);
  end if;

  if v_criando then
    insert into households(nome) values (coalesce(nullif(p_nome_lar, ''), 'Nosso lar'))
      returning id, invite_code into v_hh_id, v_invite;
  else
    select id, invite_code into v_hh_id, v_invite from households where invite_code = p_invite_code;
    if v_hh_id is null then
      raise exception 'código inválido';
    end if;
  end if;

  insert into members(user_id, household_id, nome, papel)
    values (v_uid, v_hh_id, coalesce(nullif(p_nome_membro, ''), 'Membro'),
            case when v_criando then 'dono' else 'membro' end)
    returning * into v_member;

  if v_criando then
    insert into categories(household_id, nome, tipo, cor) values
      (v_hh_id, 'Mercado', 'despesa', '#2f9e44'),
      (v_hh_id, 'Alimentação', 'despesa', '#e8590c'),
      (v_hh_id, 'Transporte', 'despesa', '#1971c2'),
      (v_hh_id, 'Contas de casa', 'despesa', '#6741d9'),
      (v_hh_id, 'Saúde', 'despesa', '#c2255c'),
      (v_hh_id, 'Lazer', 'despesa', '#f08c00'),
      (v_hh_id, 'Compras', 'despesa', '#9c36b5'),
      (v_hh_id, 'Salário', 'receita', '#2b8a3e'),
      (v_hh_id, 'Outros', 'despesa', '#6b7280');
  end if;

  return json_build_object('member', row_to_json(v_member), 'invite_code', v_invite, 'ja_membro', false);
end $$;

revoke all on function bootstrap_lar(text, text, text) from public;
grant execute on function bootstrap_lar(text, text, text) to authenticated;
