-- Subcategorias: uma categoria pode ter uma mãe (parent_id). O orçamento (budget)
-- fica na mãe; o gasto do filho soma na mãe, mas dá pra filtrar o filho à parte.
-- Um nível só (a UI não deixa uma subcategoria virar mãe de outra).
alter table categories
  add column if not exists parent_id uuid references categories(id) on delete set null;
create index if not exists categories_parent_idx on categories(parent_id);
