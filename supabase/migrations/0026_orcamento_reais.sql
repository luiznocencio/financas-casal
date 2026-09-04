-- Orçamento por categoria passa a ser em REAIS (valor_centavos) em vez de %.
alter table budgets add column if not exists valor_centavos int not null default 0;
alter table budgets alter column percentual drop not null;
alter table budgets alter column percentual set default 0;
-- semeia o valor a partir do % atual × renda da casa (preserva a alocação como ponto de partida)
update budgets b set valor_centavos = round(
  coalesce((select sum(coalesce(renda_mensal_centavos,0) + coalesce(ajuda_custo_centavos,0))
            from members m where m.household_id = b.household_id), 0)
  * coalesce(b.percentual, 0) / 100.0
) where b.valor_centavos = 0 and coalesce(b.percentual, 0) > 0;
