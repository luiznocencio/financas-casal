import type { ChamarModelo } from "./lancamento";

/** Primeira letra maiúscula, sem mexer no resto (mantém siglas e nomes como estão). */
export function inicialMaiuscula(texto: string): string {
  const t = texto.trim().replace(/\s+/g, " ");
  return t ? t.charAt(0).toLocaleUpperCase("pt-BR") + t.slice(1) : t;
}

// a correção só vale se for "a mesma frase" — o modelo não pode reescrever,
// traduzir ou inventar (ex.: "ifood" virar "Restaurante")
function pareceMesmoTexto(original: string, corrigido: string): boolean {
  const a = original.length, b = corrigido.length;
  return b > 0 && Math.abs(a - b) <= Math.max(3, Math.ceil(a * 0.3));
}

/**
 * Corrige a ortografia (acentos, letras trocadas) da descrição de um lançamento
 * manual e sempre deixa a inicial maiúscula. Se o modelo falhar, demorar ou
 * devolver algo muito diferente, fica o texto original (só com a maiúscula).
 */
export async function corrigirDescricao(texto: string, chamarModelo: ChamarModelo | null): Promise<string> {
  const original = texto.trim().replace(/\s+/g, " ");
  if (!original || !chamarModelo || !/[a-zà-ú]{3,}/i.test(original)) return inicialMaiuscula(original);
  const prompt = [
    "Corrija a ortografia deste nome de lançamento financeiro em português do Brasil.",
    "Só corrija erros de digitação e acentuação. Não traduza, não reescreva, não acrescente nem remova palavras.",
    "Mantenha nomes de lojas, marcas, apps e siglas como estão (ex.: iFood, Uber, Netflix, Pix, IPVA).",
    "Primeira letra maiúscula; o resto da capitalização só muda se for erro.",
    'Responda APENAS com JSON: {"texto": string}',
    `Texto: ${JSON.stringify(original)}`,
  ].join("\n");
  try {
    const bruto = await Promise.race([
      chamarModelo(prompt),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000)),
    ]);
    const corrigido = JSON.parse(bruto)?.texto;
    if (typeof corrigido === "string" && pareceMesmoTexto(original, corrigido.trim())) {
      return inicialMaiuscula(corrigido);
    }
  } catch {
    /* sem correção: segue com o original */
  }
  return inicialMaiuscula(original);
}
