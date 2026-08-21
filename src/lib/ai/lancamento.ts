import { reaisParaCentavos } from "@/lib/financeiro/dinheiro";

export type ContextoLancamento = {
  cartoes: { id: string; nome: string }[];
  contas: { id: string; nome: string }[];
  categorias: { id: string; nome: string }[];
  membros: string[];
};

export type SugestaoLancamento = {
  tipo: "despesa" | "receita";
  valor_centavos: number;
  descricao: string;
  categoria_id: string | null;
  card_id: string | null;
  account_id: string | null;
  pessoa: string;
  total_parcelas: number;
};

/** Chamador do modelo: recebe o prompt, devolve o texto (JSON) da resposta. */
export type ChamarModelo = (prompt: string) => Promise<string>;

export async function interpretarLancamento(
  texto: string,
  ctx: ContextoLancamento,
  chamarModelo: ChamarModelo,
): Promise<SugestaoLancamento> {
  const prompt = montarPrompt(texto, ctx);
  const bruto = await chamarModelo(prompt);
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(bruto);
  } catch {
    throw new Error("resposta do modelo não é JSON válido");
  }
  return mapear(obj, ctx);
}

function montarPrompt(texto: string, ctx: ContextoLancamento): string {
  return [
    "Você extrai um lançamento financeiro de um texto em português do Brasil.",
    "Responda APENAS com JSON no formato:",
    '{"tipo":"despesa|receita","valor_reais":number,"descricao":string,"categoria":string|null,"origem_nome":string|null,"origem_tipo":"cartao|conta|null","pessoa":string|null,"total_parcelas":number}',
    `Cartões: ${ctx.cartoes.map((c) => c.nome).join(", ") || "nenhum"}`,
    `Contas: ${ctx.contas.map((c) => c.nome).join(", ") || "nenhuma"}`,
    `Categorias: ${ctx.categorias.map((c) => c.nome).join(", ") || "nenhuma"}`,
    `Pessoas: ${ctx.membros.join(", ")}`,
    `Texto: "${texto}"`,
  ].join("\n");
}

function acharId(nome: unknown, lista: { id: string; nome: string }[]): string | null {
  if (typeof nome !== "string") return null;
  const alvo = nome.trim().toLowerCase();
  return lista.find((x) => x.nome.toLowerCase() === alvo)?.id ?? null;
}

function mapear(obj: Record<string, unknown>, ctx: ContextoLancamento): SugestaoLancamento {
  const origemTipo = obj.origem_tipo;
  const cardId = origemTipo === "cartao" ? acharId(obj.origem_nome, ctx.cartoes) : null;
  const accountId = origemTipo === "conta" ? acharId(obj.origem_nome, ctx.contas) : null;
  const valorReais = typeof obj.valor_reais === "number" ? obj.valor_reais : 0;
  const pessoa = typeof obj.pessoa === "string" && ctx.membros.includes(obj.pessoa)
    ? obj.pessoa : (ctx.membros[0] ?? "conjunto");
  return {
    tipo: obj.tipo === "receita" ? "receita" : "despesa",
    valor_centavos: reaisParaCentavos(valorReais),
    descricao: typeof obj.descricao === "string" ? obj.descricao : "",
    categoria_id: acharId(obj.categoria, ctx.categorias),
    card_id: cardId,
    account_id: accountId,
    pessoa,
    total_parcelas: typeof obj.total_parcelas === "number" && obj.total_parcelas >= 1
      ? Math.floor(obj.total_parcelas) : 1,
  };
}
