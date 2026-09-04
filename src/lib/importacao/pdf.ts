// Extração de texto de PDF no servidor, com suporte a PDF protegido por senha
// (ex.: fatura do Itaú). Usa pdfjs-dist (legacy build, roda no Node sem worker).

export type ResultadoPdf =
  | { ok: true; texto: string }
  | { ok: false; precisaSenha: boolean; senhaErrada: boolean };

type ItemTexto = { str?: string };

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
      texto += content.items.map((it) => (it as ItemTexto).str ?? "").join(" ") + "\n";
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
