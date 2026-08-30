import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";
import { limiteDisponivel } from "@/lib/financeiro/derivados";
import { fechamentoDoVencimento } from "@/lib/financeiro/fechamento";

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: cards } = await supabase.from("cards").select("*").order("nome");
  const { data: txs } = await supabase
    .from("transactions").select("card_id, valor_centavos, paga").not("card_id", "is", null);

  const resultado = (cards ?? []).map((card) => {
    const emAberto = (txs ?? []).filter((t) => t.card_id === card.id && !t.paga);
    const disponivel = limiteDisponivel(card.limite_centavos, emAberto);
    return {
      ...card,
      limite_usado_centavos: card.limite_centavos - disponivel,
      limite_disponivel_centavos: disponivel,
    };
  });
  return NextResponse.json(resultado);
}

export async function POST(req: Request) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });
  const b = await req.json();
  // fechamento pode vir direto (dia_fechamento) ou derivado do vencimento ("N dias antes")
  const diasAntes = b.dias_fechamento_antes != null ? Number(b.dias_fechamento_antes) : null;
  const diaFechamento = diasAntes != null
    ? fechamentoDoVencimento(Number(b.dia_vencimento), diasAntes)
    : b.dia_fechamento;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("cards")
    .insert({
      household_id: membro.household_id,
      nome: b.nome, bandeira: b.bandeira ?? null,
      limite_centavos: b.limite_centavos ?? 0,
      dia_fechamento: diaFechamento, dia_vencimento: b.dia_vencimento,
      dias_fechamento_antes: diasAntes,
      titular: b.titular ?? null,
    })
    .select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
