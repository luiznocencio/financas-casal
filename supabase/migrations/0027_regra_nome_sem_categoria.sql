-- Regras aprendidas agora podem ser só de NOME (renomear sem escolher categoria)
-- ou só de categoria, ou ambos. Antes categoria_id era obrigatória, o que impedia
-- aprender um apelido sem também taggear.
alter table category_rules alter column categoria_id drop not null;
