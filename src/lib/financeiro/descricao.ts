export function normalizeDescricao(s: string): string {
  return (s ?? "").toLowerCase().trim().replace(/\s+/g, " ");
}
