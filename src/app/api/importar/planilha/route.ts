import { NextResponse } from "next/server";
import { getMembroAtual } from "@/lib/auth/household";
import { planilhaParaTexto } from "@/lib/importacao/planilha";

export const runtime = "nodejs";

// Lê uma planilha (.xls/.xlsx/.ods) e devolve o texto (CSV) pra análise, no mesmo
// caminho do PDF. O parsing roda no servidor (fora do bundle do cliente).
export async function POST(req: Request) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const form = await req.formData();
    const file = form.get("arquivo");
    if (!(file instanceof File)) return NextResponse.json({ ok: false });

    const buffer = Buffer.from(await file.arrayBuffer());
    const texto = planilhaParaTexto(buffer);
    if (!texto) return NextResponse.json({ ok: false, detalhe: "Planilha sem dados legíveis" });
    return NextResponse.json({ ok: true, texto });
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    console.error("[importar/planilha] falha:", msg);
    return NextResponse.json({ ok: false, detalhe: msg.slice(0, 300) });
  }
}
