import { NextResponse } from "next/server";
import { interpretarImportacao } from "@/lib/importacao/extrair";
import { chamarModeloJson } from "@/lib/ai/openai";
import { getMembroAtual } from "@/lib/auth/household";

export async function POST(req: Request) {
  // exige usuário logado antes de gastar chamada à OpenAI
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const { texto } = await req.json();
    if (!texto || typeof texto !== "string") return NextResponse.json({ ok: false });
    const linhas = await interpretarImportacao(texto, chamarModeloJson);
    return NextResponse.json({ ok: true, linhas });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
