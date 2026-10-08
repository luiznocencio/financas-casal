// Resumo do mês em uma frase. Os NÚMEROS saem do app (já formatados em R$); a IA
// só redige. Se a IA inventar um valor que não está nos fatos, cai no texto fixo.

export type FatosResumo = {
  mes: string;                    // "outubro"
  momento: "passado" | "atual" | "futuro";
  recebo: string;                 // "R$ 9.000,00"
  gasto: string;
  resultadoPositivo: boolean;
  resultado: string;              // valor absoluto
  estado: "ok" | "comprometido" | "falta";
  livre: string;                  // valor absoluto do "Livre"/"Falta"
  gastoMesAnterior: string | null;
  gastoSubiu: boolean | null;     // vs mês anterior
  maiores: { nome: string; valor: string }[];
  estouradas: { nome: string; excesso: string }[];
  vaoPassar: { nome: string; excesso: string }[];
};

export function fraseFixa(f: FatosResumo): string {
  const partes: string[] = [];
  const verbo = f.momento === "passado" ? "entraram" : "entram";
  partes.push(`Em ${f.mes}, ${verbo} ${f.recebo} e o gasto ${f.momento === "passado" ? "foi" : "está em"} ${f.gasto}`);
  if (f.momento !== "passado") {
    partes[0] += f.estado === "ok" ? `, com ${f.livre} livres.`
      : f.estado === "comprometido" ? `; o cartão já usou ${f.livre} do próximo salário.`
        : `; faltam ${f.livre} pra fechar o mês.`;
  } else {
    partes[0] += f.resultadoPositivo ? `, sobrando ${f.resultado}.` : `, faltando ${f.resultado}.`;
  }
  if (f.maiores[0]) partes.push(`Maior gasto: ${f.maiores[0].nome} (${f.maiores[0].valor}).`);
  if (f.estouradas[0]) partes.push(`${f.estouradas[0].nome} estourou em ${f.estouradas[0].excesso}.`);
  else if (f.vaoPassar[0]) partes.push(`${f.vaoPassar[0].nome} vai passar ${f.vaoPassar[0].excesso} do limite.`);
  return partes.join(" ");
}

export function promptResumo(f: FatosResumo): string {
  return [
    "Você escreve o resumo do mês de um app de finanças de um casal, em português do Brasil.",
    "Escreva 1 ou 2 frases curtas (máx. 220 caracteres), tom direto e amigável, sem emoji, falando com o casal ('vocês').",
    "Use SOMENTE os fatos abaixo. Copie os valores em R$ EXATAMENTE como estão; não calcule, não arredonde e não invente números.",
    "Priorize: se dá pra pagar tudo (estado/livre), depois o que estourou ou vai passar, depois a maior categoria ou a comparação com o mês anterior.",
    "estado: ok = sobra livre; comprometido = o cartão já usou parte do próximo salário; falta = não fecha o mês.",
    'Responda APENAS JSON: {"frase": string}',
    "Fatos:",
    JSON.stringify(f),
  ].join("\n");
}

// Todo valor em reais da frase (com ou sem "R$") precisa existir nos fatos.
const VALOR = /\d[\d.]*,\d{2}/g;
export function fraseConfere(frase: string, f: FatosResumo): boolean {
  if (!frase || frase.length > 320) return false;
  const permitidos = new Set(JSON.stringify(f).match(VALOR) ?? []);
  return (frase.match(VALOR) ?? []).every((v) => permitidos.has(v));
}
