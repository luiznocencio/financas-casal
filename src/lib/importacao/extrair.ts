import { reaisParaCentavos } from "@/lib/financeiro/dinheiro";

export type LinhaImportada = {
  data: string;
  descricao: string;
  valor_centavos: number;
  tipo: "despesa" | "receita";
  total_parcelas: number;
};

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function montarPrompt(texto: string, totalEsperadoReais?: string): string {
  return [
    "Extraia os lançamentos financeiros deste extrato/fatura de cartão (texto colado; cada transação começa com a data DD/MM).",
    "Responda APENAS JSON no formato:",
    '{"lancamentos":[{"data":"YYYY-MM-DD","descricao":string,"valor_reais":number,"tipo":"despesa|receita","total_parcelas":number}]}',
    "Extraia TODAS as linhas de transação, uma por uma, sem pular nenhuma e sem resumir.",
    "IGNORE linhas de categoria (ex.: 'ALIMENTAÇÃO .MACEIO'), total/subtotal/saldo/pagamento/limite/encargos de resumo.",
    "NÃO inclua parcelas de MESES FUTUROS ('Compras parceladas - próximas faturas', 'próxima fatura', 'demais faturas').",
    totalEsperadoReais
      ? `O total DESTA fatura é R$ ${totalEsperadoReais}. A soma das despesas menos as receitas/estornos DEVE bater com esse total.`
      : "",
    "Regras: valor_reais sempre positivo; tipo 'receita' para créditos/estornos/pagamentos (valor negativo vira receita), 'despesa' no resto;",
    "número tipo '05/06' após a descrição indica parcela (total_parcelas = 6); '3/12' => 12; senão 1. data no formato YYYY-MM-DD.",
    "Texto:",
    texto,
  ].filter(Boolean).join("\n");
}

// Corta a seção de parcelas de MESES FUTUROS ("Compras parceladas - próximas
// faturas") que algumas faturas (ex.: Itaú) listam depois dos lançamentos atuais
// — senão a extração soma parcelas que não são desta fatura. Se não achar o
// marcador, devolve o texto inteiro (não afeta outros formatos).
export function cortarSecaoFuturas(texto: string): string {
  const re = /compras\s+parceladas[\s\S]{0,40}?faturas/i;
  const m = texto.match(re);
  return m && m.index != null ? texto.slice(0, m.index) : texto;
}

// Detecta o total declarado da fatura no texto, pra conferir contra a soma dos
// lançamentos extraídos (pega extração incompleta). Retorna centavos ou null.
export function detectarTotalFatura(texto: string): number | null {
  const num = "R?\\$?\\s*([\\d.]{1,12},\\d{2})";
  // "total a pagar" é ambíguo (aparece com encargos/parcelado), fica de fora
  const padroes = [
    new RegExp(`total\\s+desta\\s+fatura[^\\d\\n]{0,25}${num}`, "i"),
    new RegExp(`total\\s+da\\s+sua\\s+fatura[^\\d\\n]{0,25}${num}`, "i"),
    new RegExp(`total\\s+dos\\s+lan[^\\n]{0,20}atuais[^\\d\\n]{0,25}${num}`, "i"),
    new RegExp(`valor\\s+total\\s+da\\s+fatura[^\\d\\n]{0,25}${num}`, "i"),
    // "da fatura" mas NÃO "da fatura anterior" (essa é a fatura passada)
    new RegExp(`total\\s+da\\s+fatura(?!\\s+anterior)[^\\d\\n]{0,25}${num}`, "i"),
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
  totalEsperadoCentavos?: number | null,
): Promise<LinhaImportada[]> {
  const totalReais = totalEsperadoCentavos && totalEsperadoCentavos > 0
    ? (totalEsperadoCentavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : undefined;
  const bruto = await chamarModelo(montarPrompt(texto, totalReais));
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
