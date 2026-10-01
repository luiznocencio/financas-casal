-- Regras de nome/categoria por cartão. O casal tem assinaturas com o mesmo texto
-- no banco (TOTALPASS, WELLHUB) em cartões diferentes, e o renome de um vazava
-- pro outro. Agora a regra pode ter card_id: a do cartão tem prioridade; a da casa
-- (card_id nulo) é o padrão. NULLS NOT DISTINCT: uma regra da casa + uma por cartão.
alter table category_rules add column card_id uuid references cards(id) on delete cascade;
alter table category_rules drop constraint category_rules_household_id_chave_key;
alter table category_rules add constraint category_rules_household_chave_card_key
  unique nulls not distinct (household_id, chave, card_id);
