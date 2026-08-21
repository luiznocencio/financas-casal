const REGRAS: { palavras: string[]; categoria: string }[] = [
  { palavras: ["ifood", "restaurante", "lanche", "pizza", "almoço", "almoco", "jantar"], categoria: "alimentação" },
  { palavras: ["uber", "99", "gasolina", "combustível", "combustivel", "ônibus", "onibus", "metrô", "metro"], categoria: "transporte" },
  { palavras: ["mercado", "supermercado", "hortifruti", "feira"], categoria: "mercado" },
  { palavras: ["farmácia", "farmacia", "remédio", "remedio", "consulta", "exame"], categoria: "saúde" },
];

export function sugerirCategoria(
  descricao: string,
  categorias: { id: string; nome: string }[],
): string | null {
  const texto = descricao.toLowerCase();
  for (const regra of REGRAS) {
    if (regra.palavras.some((p) => texto.includes(p))) {
      const cat = categorias.find((c) => c.nome.toLowerCase() === regra.categoria);
      if (cat) return cat.id;
    }
  }
  return null;
}
