import type { SupabaseClient } from "@supabase/supabase-js";

// Regras aprendidas de nome/categoria. Podem ser do CARTÃO (card_id) ou da CASA
// (card_id nulo). O casal tem assinaturas com o mesmo texto no banco (TOTALPASS,
// WELLHUB) em cartões diferentes: a regra do cartão manda; a da casa é o padrão.
export type Regra = {
  chave: string;
  card_id: string | null;
  categoria_id: string | null;
  descricao_preferida: string | null;
};

export function indexarRegras(lista: Regra[]): Map<string, Regra> {
  return new Map(lista.map((r) => [`${r.chave}|${r.card_id ?? ""}`, r]));
}

// Regra que vale para (chave, cartão): a do cartão tem prioridade e a da casa
// completa o que faltar. Sem cartão (conta/pix), só a da casa.
export function regraEfetiva(
  regras: Map<string, Regra>, chave: string, cardId: string | null,
): { categoria_id: string | null; descricao_preferida: string | null } | null {
  const doCartao = cardId ? regras.get(`${chave}|${cardId}`) : undefined;
  const daCasa = regras.get(`${chave}|`);
  if (!doCartao && !daCasa) return null;
  return {
    categoria_id: doCartao?.categoria_id ?? daCasa?.categoria_id ?? null,
    descricao_preferida: doCartao?.descricao_preferida ?? daCasa?.descricao_preferida ?? null,
  };
}

type Aprendizado = { chave: string; categoria_id?: string | null; nome?: string | null };

// Aprende (com merge: não apaga o campo que não veio). Grava na regra do cartão
// quando há cardId, ou na da casa. Quando é de cartão, a casa herda SÓ a categoria
// e só se ainda não tiver regra — o nome nunca vaza de um cartão pro outro.
export async function aprenderRegras(
  supabase: SupabaseClient, householdId: string, cardId: string | null, itens: Aprendizado[],
): Promise<void> {
  // uma entrada por chave (o upsert não aceita a mesma linha duas vezes)
  const porChave = new Map<string, Aprendizado>();
  for (const i of itens) {
    if (!i.chave) continue;
    const atual = porChave.get(i.chave);
    porChave.set(i.chave, {
      chave: i.chave,
      categoria_id: i.categoria_id ?? atual?.categoria_id ?? null,
      nome: i.nome ?? atual?.nome ?? null,
    });
  }
  const lista = [...porChave.values()].filter((i) => i.categoria_id || i.nome);
  if (!lista.length) return;

  let q = supabase.from("category_rules").select("chave, categoria_id, descricao_preferida")
    .in("chave", lista.map((i) => i.chave));
  q = cardId ? q.eq("card_id", cardId) : q.is("card_id", null);
  const { data: existentes } = await q;
  const antigo = new Map((existentes ?? []).map((r) => [r.chave as string, r]));

  await supabase.from("category_rules").upsert(
    lista.map((i) => {
      const old = antigo.get(i.chave);
      return {
        household_id: householdId, chave: i.chave, card_id: cardId,
        categoria_id: i.categoria_id ?? old?.categoria_id ?? null,
        descricao_preferida: i.nome ?? old?.descricao_preferida ?? null,
      };
    }),
    { onConflict: "household_id,chave,card_id" },
  );

  if (cardId) {
    const padroes = lista.filter((i) => i.categoria_id).map((i) => ({
      household_id: householdId, chave: i.chave, card_id: null, categoria_id: i.categoria_id,
    }));
    if (padroes.length) {
      await supabase.from("category_rules").upsert(padroes, { onConflict: "household_id,chave,card_id", ignoreDuplicates: true });
    }
  }
}
