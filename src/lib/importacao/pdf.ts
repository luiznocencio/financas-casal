// Extração de texto de PDF no servidor, com suporte a PDF protegido por senha
// (ex.: fatura do Itaú). Usa pdfjs-dist (legacy build, roda no Node sem worker).
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export type ResultadoPdf =
  | { ok: true; texto: string }
  | { ok: false; precisaSenha: boolean; senhaErrada: boolean };

type ItemTexto = { str?: string };

export async function extrairTextoPdf(buffer: Buffer, senha?: string): Promise<ResultadoPdf> {
  try {
    const doc = await getDocument({
      data: new Uint8Array(buffer),
      password: senha || undefined,
      isEvalSupported: false,
      useSystemFonts: false,
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
