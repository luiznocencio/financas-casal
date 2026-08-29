-- "Até quando" o recorrente vale (opcional). Depois dessa data ele não é mais
-- lançado. Vale para gastos fixos e para receitas mensais agendadas.
alter table recorrentes add column data_fim date;
alter table receitas_agendadas add column data_fim date;
