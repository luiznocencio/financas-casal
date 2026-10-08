// O Supabase (PostgREST) devolve no máximo 1000 linhas por consulta — SEM erro,
// só corta. Num app de dinheiro isso viraria saldo/total errado em silêncio
// quando o histórico passar disso. `todas` busca em páginas até acabar.
//
// Uso: todas((de, ate) => supabase.from("transactions").select("...").order("id").range(de, ate))
// A consulta PRECISA ter uma ordem estável (ex.: .order("id")) pra paginar certo.

type Resposta<T> = { data: T[] | null; error: { message: string } | null };

export const LOTE = 1000;

export async function todas<T>(
  pagina: (de: number, ate: number) => PromiseLike<Resposta<T>>,
  lote = LOTE,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const linhas: T[] = [];
  for (let de = 0; ; de += lote) {
    const { data, error } = await pagina(de, de + lote - 1);
    if (error) return { data: [], error }; // nunca devolve parcial calado
    linhas.push(...(data ?? []));
    if (!data || data.length < lote) return { data: linhas, error: null };
  }
}
