import { NextResponse } from "next/server";
import { interpretarImportacao } from "@/lib/importacao/extrair";
import { chamarModeloJson } from "@/lib/ai/openai";

export async function POST(req: Request) {
  try {
    const { texto } = await req.json();
    if (!texto || typeof texto !== "string") return NextResponse.json({ ok: false });
    const linhas = await interpretarImportacao(texto, chamarModeloJson);
    return NextResponse.json({ ok: true, linhas });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
