-- Qual MÊS da conta a pagar o pagamento quita ('YYYY-MM'). Antes, o mês saía da
-- data do pagamento — conta de setembro paga em outubro "sumia" de setembro e
-- ainda contava como a de outubro. Agora a conta não paga continua pendente
-- (atrasada) até ser quitada, e a data do pagamento pode ser outra.
alter table transactions add column conta_pagar_ref text
  check (conta_pagar_ref is null or conta_pagar_ref ~ '^\d{4}-(0[1-9]|1[0-2])$');

-- histórico: o mês quitado era o mês da data do pagamento
update transactions set conta_pagar_ref = to_char(data_compra, 'YYYY-MM')
  where conta_pagar_id is not null and conta_pagar_ref is null;

-- um pagamento por conta+mês (evita quitar o mesmo mês duas vezes)
create unique index transactions_conta_pagar_ref_uniq
  on transactions (conta_pagar_id, conta_pagar_ref) where conta_pagar_id is not null;
