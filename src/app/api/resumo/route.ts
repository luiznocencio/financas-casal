import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getMembroAtual } from "@/lib/auth/household";
import { createServerSupabase } from "@/lib/supabase/server";
import { chamarModeloJson } from "@/lib/ai/openai";
import { fraseFixa, fraseConfere, promptResumo, type FatosResumo } from "@/lib/financeiro/resumoFrase";

// Resumo do mês em uma frase. Os números chegam prontos (calculados na Home); a
// IA só redige. Cache por (casa, mês, hash dos números): só chama a IA de novo
// quando algum número muda.
export async function POST(req: Request) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const mes: unknown = body?.mes;
  const fatos = body?.fatos as FatosResumo | undefined;
  if (typeof mes !== "string" || !/^\d{4}-\d{2}$/.test(mes) || !fatos || typeof fatos.recebo !== "string") {
    return NextResponse.json({ error: "dados inválidos" }, { status: 400 });
  }
  const fixa = fraseFixa(fatos);
  const hash = createHash("sha256").update(JSON.stringify(fatos)).digest("hex");

  const supabase = await createServerSupabase();
  const { data: cache } = await supabase.from("resumos_mes").select("hash, texto").eq("mes", mes).maybeSingle();
  if (cache?.hash === hash) return NextResponse.json({ texto: cache.texto });

  let texto = fixa;
  try {
    const bruto = await chamarModeloJson(promptResumo(fatos));
    const frase = String(JSON.parse(bruto)?.frase ?? "").trim();
    if (fraseConfere(frase, fatos)) texto = frase; // valor inventado → fica a frase fixa
  } catch {
    // IA fora do ar: devolve a frase fixa sem guardar (tenta de novo na próxima)
    return NextResponse.json({ texto: fixa });
  }
  await supabase.from("resumos_mes").upsert(
    { household_id: membro.household_id, mes, hash, texto, updated_at: new Date().toISOString() },
    { onConflict: "household_id,mes" },
  );
  return NextResponse.json({ texto });
}
