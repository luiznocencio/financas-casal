// Regras de ocorrência de uma conta a pagar por mês.
// - mensal: repete todo mês, da 1ª ocorrência (a partir da criação) até data_fim.
// - unica: acontece uma vez só, no mês da 1ª ocorrência.
// A "1ª ocorrência" é o mês do vencimento a partir da data de criação: se o dia
// já passou no mês em que foi cadastrada, começa no mês seguinte.

export type ContaOcorrencia = {
  dia_vencimento: number;
  recorrencia: "unica" | "mensal";
  data_fim: string | null;
  created_at: string;
};

const idx = (ano: number, mes: number) => ano * 12 + mes;

export function mesRefConta(createdAtISO: string, dia: number): { ano: number; mes: number } {
  const [ca, cm, cd] = createdAtISO.slice(0, 10).split("-").map(Number);
  if (dia >= cd) return { ano: ca, mes: cm };
  return cm === 12 ? { ano: ca + 1, mes: 1 } : { ano: ca, mes: cm + 1 };
}

// A conta tem uma cobrança devida no mês (ano, mes)?
export function contaOcorreNoMes(c: ContaOcorrencia, ano: number, mes: number): boolean {
  const ref = mesRefConta(c.created_at, c.dia_vencimento);
  const iRef = idx(ref.ano, ref.mes);
  const iAlvo = idx(ano, mes);
  if (c.recorrencia === "unica") return iAlvo === iRef;
  if (iAlvo < iRef) return false; // ainda não começou
  if (c.data_fim) {
    const [fa, fm] = c.data_fim.slice(0, 10).split("-").map(Number);
    if (iAlvo > idx(fa, fm)) return false; // já encerrou
  }
  return true;
}

// A conta deve aparecer na lista do mês atual? (mensal: se ocorre agora; unica:
// do mês dela em diante, até ser paga — a menos que tenha sido paga neste mês,
// aí ainda aparece marcada como "pago").
export function contaVisivelNoMes(
  c: ContaOcorrencia,
  ano: number,
  mes: number,
  jaPagaAlgumaVez: boolean,
  pagaNesteMes: boolean,
): boolean {
  if (c.recorrencia === "mensal") return contaOcorreNoMes(c, ano, mes);
  const ref = mesRefConta(c.created_at, c.dia_vencimento);
  const chegou = idx(ano, mes) >= idx(ref.ano, ref.mes);
  return chegou && (!jaPagaAlgumaVez || pagaNesteMes);
}
