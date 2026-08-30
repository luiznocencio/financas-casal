-- Ao pagar uma fatura, o valor sai de uma conta escolhida: criamos um lançamento
-- de transferência (reduz o saldo da conta, sem contar como despesa nova) ligado
-- à fatura. Assim dá pra reverter (apagar esse lançamento) ao desfazer.
alter table transactions add column pagamento_invoice_id uuid references invoices(id) on delete cascade;
create index transactions_pagamento_invoice_idx on transactions(pagamento_invoice_id);
-- (contas_pagar.account_id/card_id já são nulas; a origem passa a ser escolhida no pagamento)
