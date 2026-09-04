import { normalizeDescricao } from "./descricao";

// Um lançamento já existente (pra comparar com um gasto fixo).
export type TxExistente = {
  recorrente_id: string | null;
  descricao: string | null;
  valor_centavos: number;
  card_id: string | null;
  account_id: string | null;
};

export type FixoRef = {
  id: string;
  descricao: string;
  valor_centavos: number;
  card_id: string | null;
  account_id: string | null;
};

// Casa descrições sendo tolerante (ex.: "Netflix" x "NETFLIX.COM").
export function casaDescricao(a: string, b: string): boolean {
  const x = normalizeDescricao(a), y = normalizeDescricao(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
}

// O gasto fixo já foi lançado neste mês? Vale o vínculo direto (recorrente_id) ou
// um lançamento equivalente: mesma origem (cartão/conta) + valor + descrição parecida.
// `existentes` deve incluir os lançamentos do mês (conta por data + cartão pela
// competência da fatura), pra pegar a compra do cartão mesmo com data de outro mês.
export function recorrenteJaLancado(r: FixoRef, existentes: TxExistente[]): boolean {
  return existentes.some((t) =>
    t.recorrente_id === r.id ||
    (t.valor_centavos === r.valor_centavos &&
      (r.card_id ? t.card_id === r.card_id : t.account_id === r.account_id) &&
      casaDescricao(t.descricao ?? "", r.descricao)),
  );
}
