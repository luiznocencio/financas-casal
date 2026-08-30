-- Fechamento definido como "N dias antes do vencimento" (mais estável que um
-- dia fixo, que variava em meses de 30/31). O dia_fechamento continua existindo
-- (derivado = vencimento - N) porque toda a lógica de competência usa ele.
alter table cards add column dias_fechamento_antes int;
