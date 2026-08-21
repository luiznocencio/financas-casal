/** Cor de identidade da pessoa: 1º membro=a, 2º=b, resto/conjunto=conjunto. */
export function corDaPessoa(nome: string, membros: string[]): string {
  const idx = membros.indexOf(nome);
  if (idx === 0) return "var(--pessoa-a)";
  if (idx === 1) return "var(--pessoa-b)";
  return "var(--pessoa-conjunto)";
}
