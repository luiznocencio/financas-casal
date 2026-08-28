-- Marca cada lote de importação para permitir apagar "um extrato importado" inteiro.
alter table transactions add column grupo_importacao uuid;
create index transactions_grupo_importacao_idx on transactions(grupo_importacao);
