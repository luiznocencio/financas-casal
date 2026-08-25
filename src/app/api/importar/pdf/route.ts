import { NextResponse } from "next/server";
import { getMembroAtual } from "@/lib/auth/household";
import pdf from "pdf-parse";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const form = await req.formData();
    const file = form.get("arquivo");
    if (!(file instanceof File)) return NextResponse.json({ ok: false });
    const buffer = Buffer.from(await file.arrayBuffer());
    const data = await pdf(buffer);
    const texto = (data.text ?? "").trim();
    if (!texto) return NextResponse.json({ ok: false });
    return NextResponse.json({ ok: true, texto });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
