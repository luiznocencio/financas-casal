import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

// Transferência entre contas: cria um PAR de lançamentos ligados por
// grupo_transferencia — saída na origem e entrada no destino. Nenhum dos dois
// conta como despesa/receita nas estatísticas.
export async function POST(req: Request) {
  const membro = await getMembroAtual();
  if (!membro) return NextResponse.json({ error: "sem household" }, { status: 400 });

  const b = await req.json().catch(() => ({}));
  const origem = b.origem_account_id as string | undefined;
  const destino = b.destino_account_id as string | undefined;
  const valor = Math.round(Number(b.valor_centavos));
  const data = DATA_ISO.test(b.data ?? "") ? b.data : new Date().toISOString().slice(0, 10);
  const descricao = typeof b.descricao === "string" && b.descricao.trim() ? b.descricao.trim() : null;

  if (!origem || !destino) return NextResponse.json({ error: "escolha origem e destino" }, { status: 400 });
  if (origem === destino) return NextResponse.json({ error: "origem e destino iguais" }, { status: 400 });
  if (!(valor > 0)) return NextResponse.json({ error: "valor inválido" }, { status: 400 });

  const supabase = await createServerSupabase();
  const { data: contas, error: errContas } = await supabase
    .from("accounts").select("id, nome").in("id", [origem, destino]);
  if (errContas) return NextResponse.json({ error: errContas.message }, { status: 500 });
  if ((contas ?? []).length !== 2) return NextResponse.json({ error: "conta inexistente" }, { status: 400 });
  const nome = new Map((contas ?? []).map((c) => [c.id, c.nome]));

  const grupo = crypto.randomUUID();
  const base = {
    household_id: membro.household_id, valor_centavos: valor, data_compra: data,
    categoria_id: null, pessoa: "conjunto", card_id: null, total_parcelas: 1, parcela_n: 1,
    criado_por: membro.user_id, paga: false, origem_ia: false, grupo_transferencia: grupo,
  };
  const sufixo = descricao ? ` (${descricao})` : "";
  const { error } = await supabase.from("transactions").insert([
    { ...base, tipo: "transferencia", account_id: origem, descricao: `Transferência → ${nome.get(destino)}${sufixo}` },
    { ...base, tipo: "transferencia_entrada", account_id: destino, descricao: `Transferência ← ${nome.get(origem)}${sufixo}` },
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
