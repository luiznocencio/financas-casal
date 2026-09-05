// Extração de texto de PDF no servidor, com suporte a PDF protegido por senha
// (ex.: fatura do Itaú). Usa pdfjs-dist (legacy build, roda no Node sem worker).

export type ResultadoPdf =
  | { ok: true; texto: string }
  | { ok: false; precisaSenha: boolean; senhaErrada: boolean };

type ItemTexto = { str?: string; transform?: number[] };

const RE_DATA = /^\d{2}\/\d{2}$/;
const RE_VALOR = /\d,\d{2}/; // um valor em reais (…,dd) já apareceu na transação

// Reconstrói as linhas de uma página pela posição (y) dos itens, ordenando por x.
// Faturas vêm em COLUNAS (2+ lançamentos lado a lado); cada lançamento começa com
// uma data DD/MM, então quebramos a linha a cada data — assim cada transação fica
// numa linha só e a IA não confunde colunas.
function linhasDaPagina(items: ItemTexto[]): string {
  const linhas = new Map<number, { x: number; str: string }[]>();
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const y = Math.round((it.transform?.[5] ?? 0) / 2) * 2; // agrupa por linha (~2px)
    const x = it.transform?.[4] ?? 0;
    (linhas.get(y) ?? linhas.set(y, []).get(y)!).push({ x, str: it.str });
  }
  const out: string[] = [];
  for (const [, itens] of [...linhas.entries()].sort((a, b) => b[0] - a[0])) {
    const ordenados = itens.sort((a, b) => a.x - b.x);
    let atual: string[] = [];
    const flush = () => { const s = atual.join(" ").replace(/\s{2,}/g, " ").trim(); if (s) out.push(s); atual = []; };
    for (const it of ordenados) {
      // nova transação começa numa data — mas só se a atual já tem um valor (senão
      // um "05/06" de parcela ou "12/24" na descrição quebraria a linha no meio)
      if (RE_DATA.test(it.str.trim()) && atual.some((s) => RE_VALOR.test(s))) flush();
      atual.push(it.str);
    }
    flush();
  }
  return out.join("\n");
}

// pdfjs v4 usa Promise.withResolvers (Node 22+); em runtimes com Node 20 isso
// não existe e quebra a leitura. Polyfill defensivo antes de carregar o pdfjs.
function garantirPolyfill() {
  const P = Promise as unknown as { withResolvers?: () => unknown };
  if (typeof P.withResolvers !== "function") {
    P.withResolvers = function <T>() {
      let resolve!: (v: T | PromiseLike<T>) => void;
      let reject!: (r?: unknown) => void;
      const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
      return { promise, resolve, reject };
    };
  }
}

export async function extrairTextoPdf(buffer: Buffer, senha?: string): Promise<ResultadoPdf> {
  garantirPolyfill();
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  try {
    const doc = await getDocument({
      data: new Uint8Array(buffer),
      password: senha || undefined,
      isEvalSupported: false,
      useSystemFonts: false,
      useWorkerFetch: false,
    }).promise;

    let texto = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      texto += linhasDaPagina(content.items as ItemTexto[]) + "\n";
    }
    await doc.destroy();
    return { ok: true, texto: texto.trim() };
  } catch (e) {
    // PasswordException: code 1 = precisa de senha, 2 = senha incorreta
    const err = e as { name?: string; code?: number };
    if (err?.name === "PasswordException") {
      return { ok: false, precisaSenha: true, senhaErrada: err.code === 2 };
    }
    throw e;
  }
}
