import { reaisParaCentavos } from "@/lib/financeiro/dinheiro";

export type LinhaImportada = {
  data: string;
  descricao: string;
  valor_centavos: number;
  tipo: "despesa" | "receita";
  total_parcelas: number;
};

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function montarPrompt(texto: string): string {
  return [
    "Extraia os lançamentos financeiros deste extrato/fatura (texto colado, pode ser CSV).",
    "Responda APENAS JSON no formato:",
    '{"lancamentos":[{"data":"YYYY-MM-DD","descricao":string,"valor_reais":number,"tipo":"despesa|receita","total_parcelas":number}]}',
    "IMPORTANTE: extraia TODOS os lançamentos, um por um, sem pular nenhum e sem resumir.",
    "Percorra o texto inteiro (todas as páginas). NÃO inclua linhas de total/subtotal/saldo/pagamento",
    "da fatura, limites, encargos de resumo — apenas as COMPRAS e créditos individuais.",
    "Regras: valor_reais sempre positivo; tipo 'receita' para créditos/estornos/pagamentos recebidos, 'despesa' para o resto;",
    "se a descrição indicar parcela (ex.: '3/12'), total_parcelas = 12, senão 1; data no formato YYYY-MM-DD.",
    "Texto:",
    texto,
  ].join("\n");
}

// Detecta o total declarado da fatura no texto, pra conferir contra a soma dos
// lançamentos extraídos (pega extração incompleta). Retorna centavos ou null.
export function detectarTotalFatura(texto: string): number | null {
  const num = "R?\\$?\\s*([\\d.]{1,12},\\d{2})";
  const padroes = [
    new RegExp(`total\\s+da\\s+sua\\s+fatura[^\\d\\n]{0,25}${num}`, "i"),
    new RegExp(`total\\s+desta\\s+fatura[^\\d\\n]{0,25}${num}`, "i"),
    new RegExp(`total\\s+da\\s+fatura[^\\d\\n]{0,25}${num}`, "i"),
    new RegExp(`valor\\s+total\\s+da\\s+fatura[^\\d\\n]{0,25}${num}`, "i"),
    new RegExp(`total\\s+a\\s+pagar[^\\d\\n]{0,25}${num}`, "i"),
  ];
  for (const re of padroes) {
    const m = texto.match(re);
    if (m) {
      const v = Number(m[1].replace(/\./g, "").replace(",", "."));
      if (v > 0) return Math.round(v * 100);
    }
  }
  return null;
}

export async function interpretarImportacao(
  texto: string,
  chamarModelo: (prompt: string) => Promise<string>,
): Promise<LinhaImportada[]> {
  const bruto = await chamarModelo(montarPrompt(texto));
  let obj: { lancamentos?: unknown };
  try {
    obj = JSON.parse(bruto);
  } catch {
    throw new Error("resposta do modelo não é JSON válido");
  }
  const lista = Array.isArray(obj.lancamentos) ? obj.lancamentos : [];
  const linhas: LinhaImportada[] = [];
  for (const item of lista as Record<string, unknown>[]) {
    const data = typeof item.data === "string" ? item.data : "";
    const valorReais = typeof item.valor_reais === "number" ? item.valor_reais : 0;
    if (!DATA_ISO.test(data) || valorReais <= 0) continue;
    linhas.push({
      data,
      descricao: typeof item.descricao === "string" ? item.descricao : "",
      valor_centavos: reaisParaCentavos(valorReais),
      tipo: item.tipo === "receita" ? "receita" : "despesa",
      total_parcelas: typeof item.total_parcelas === "number" && item.total_parcelas >= 1
        ? Math.floor(item.total_parcelas) : 1,
    });
  }
  return linhas;
}
