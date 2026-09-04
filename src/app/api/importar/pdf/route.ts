import { NextResponse } from "next/server";
import { getMembroAtual } from "@/lib/auth/household";
import { extrairTextoPdf } from "@/lib/importacao/pdf";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const form = await req.formData();
    const file = form.get("arquivo");
    const senha = typeof form.get("senha") === "string" ? (form.get("senha") as string) : undefined;
    if (!(file instanceof File)) return NextResponse.json({ ok: false });

    const buffer = Buffer.from(await file.arrayBuffer());
    const r = await extrairTextoPdf(buffer, senha);
    if (!r.ok) {
      // PDF protegido: pede a senha (ou avisa que a senha está errada)
      return NextResponse.json({ ok: false, precisaSenha: true, senhaErrada: r.senhaErrada });
    }
    if (!r.texto) return NextResponse.json({ ok: false });
    return NextResponse.json({ ok: true, texto: r.texto });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
