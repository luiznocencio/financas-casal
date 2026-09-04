-- Renda em duas partes por pessoa: renda_mensal_centavos passa a ser o SALÁRIO;
-- ajuda_custo_centavos é a 2ª parte. Cada parte pode cair numa conta diferente.
alter table members add column if not exists ajuda_custo_centavos int not null default 0;
alter table members add column if not exists salario_account_id uuid references accounts(id) on delete set null;
alter table members add column if not exists ajuda_custo_account_id uuid references accounts(id) on delete set null;
