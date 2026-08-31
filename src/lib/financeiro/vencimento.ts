import { ultimoDiaDoMes } from "./fechamento";

const pad = (n: number) => String(n).padStart(2, "0");

export type Vencimento = { ano: number; mes: number; dia: number; atrasada: boolean };

// Próximo vencimento de uma conta a pagar (recorrente por dia). Se a conta foi
// CADASTRADA depois de já ter passado o vencimento deste mês, ela é pro mês que
// vem (não é atraso — foi lançada pro próximo). Do contrário, se o dia já passou
// e não foi paga, é atraso de verdade.
export function proximoVencimento(
  diaVencimento: number,
  hoje: { ano: number; mes: number; dia: number },
  criadaEmISO: string | null,
  jaPaga: boolean,
): Vencimento {
  const diaEsteMes = Math.min(diaVencimento, ultimoDiaDoMes(hoje.ano, hoje.mes));
  const dataEsteMes = `${hoje.ano}-${pad(hoje.mes)}-${pad(diaEsteMes)}`;
  const passou = diaEsteMes < hoje.dia;
  const criada = (criadaEmISO ?? "").slice(0, 10);
  const proProximo = !jaPaga && passou && (criada ? criada > dataEsteMes : true);

  if (proProximo) {
    const ano = hoje.mes === 12 ? hoje.ano + 1 : hoje.ano;
    const mes = hoje.mes === 12 ? 1 : hoje.mes + 1;
    return { ano, mes, dia: Math.min(diaVencimento, ultimoDiaDoMes(ano, mes)), atrasada: false };
  }
  return { ano: hoje.ano, mes: hoje.mes, dia: diaEsteMes, atrasada: !jaPaga && passou };
}
