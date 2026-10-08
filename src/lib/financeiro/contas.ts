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

export type Mes = { ano: number; mes: number };
export const chaveMes = (m: Mes) => `${m.ano}-${String(m.mes).padStart(2, "0")}`;

// Mês da conta que um pagamento quita: o registrado (conta_pagar_ref) ou, nos
// pagamentos antigos, o mês da data do pagamento.
export function mesQuitado(t: { conta_pagar_ref?: string | null; data_compra: string }): string {
  return t.conta_pagar_ref ?? t.data_compra.slice(0, 7);
}

// Meses devidos e AINDA NÃO quitados, da 1ª ocorrência até `ate` (inclusive), do
// mais antigo pro mais novo. Conta não paga não some na virada do mês: fica
// pendente (atrasada) até ser quitada. Olha no máximo 24 meses pra trás.
export function mesesEmAberto(c: ContaOcorrencia, quitados: Set<string>, ate: Mes): Mes[] {
  const ref = mesRefConta(c.created_at, c.dia_vencimento);
  const iAte = idx(ate.ano, ate.mes);
  const de = Math.max(idx(ref.ano, ref.mes), iAte - 23);
  const abertos: Mes[] = [];
  for (let i = de; i <= iAte; i++) {
    const ano = Math.floor((i - 1) / 12);
    const m: Mes = { ano, mes: i - ano * 12 };
    if (contaOcorreNoMes(c, m.ano, m.mes) && !quitados.has(chaveMes(m))) abertos.push(m);
  }
  return abertos;
}

// { conta_pagar_id -> meses já quitados }
export function quitadosPorConta(txs: { conta_pagar_id: string | null; conta_pagar_ref?: string | null; data_compra: string }[]) {
  const m = new Map<string, Set<string>>();
  for (const t of txs) {
    if (!t.conta_pagar_id) continue;
    (m.get(t.conta_pagar_id) ?? m.set(t.conta_pagar_id, new Set()).get(t.conta_pagar_id)!).add(mesQuitado(t));
  }
  return m;
}
