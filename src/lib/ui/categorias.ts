// Ordena categorias colocando cada subcategoria logo após a mãe, com um rótulo
// "Mãe › Filho" pros seletores. Filhos órfãos (mãe fora da lista) vão pro fim.
export type CatComPai = { id: string; nome: string; parent_id?: string | null };

export function ordenarComSubcategorias<T extends CatComPai>(cats: T[]): (T & { rotulo: string })[] {
  const maes = cats.filter((c) => !c.parent_id);
  const idsMae = new Set(maes.map((m) => m.id));
  const filhosPorMae = new Map<string, T[]>();
  for (const c of cats) if (c.parent_id) (filhosPorMae.get(c.parent_id) ?? filhosPorMae.set(c.parent_id, []).get(c.parent_id)!).push(c);

  const out: (T & { rotulo: string })[] = [];
  for (const mae of maes) {
    out.push({ ...mae, rotulo: mae.nome });
    for (const f of filhosPorMae.get(mae.id) ?? []) out.push({ ...f, rotulo: `${mae.nome} › ${f.nome}` });
  }
  for (const c of cats) if (c.parent_id && !idsMae.has(c.parent_id)) out.push({ ...c, rotulo: c.nome });
  return out;
}
