-- Cartão principal do lar: vem pré-selecionado no lançamento manual. Só um por
-- lar (a API zera os outros ao marcar um). Índice parcial garante no máximo um.
alter table cards add column principal boolean not null default false;
create unique index cards_um_principal_por_lar on cards (household_id) where principal;
