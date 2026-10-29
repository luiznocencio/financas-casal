"use client";
import { faturaDaCompra, fechamentoDaFatura, vencimentoDaFatura, type Dia } from "@/lib/financeiro/fatura";
import { fechamentoDoVencimento } from "@/lib/financeiro/fechamento";

const fmt = (d: Dia) => `${String(d.dia).padStart(2, "0")}/${String(d.mes).padStart(2, "0")}`;

// Mostra ao vivo os próximos fechamentos/vencimentos, pra conferir o setup. O dia
// do fechamento muda com o tamanho do mês (é contado a partir do vencimento).
export function FechamentoPreview({ vencimento, diasAntes }: { vencimento: number; diasAntes: number }) {
  if (!(vencimento >= 1 && vencimento <= 31) || !(diasAntes >= 0 && diasAntes <= 27)) return null;
  const regra = { dia_fechamento: fechamentoDoVencimento(vencimento, diasAntes), dia_vencimento: vencimento, dias_fechamento_antes: diasAntes };
  const agora = new Date();
  const c = faturaDaCompra({ ano: agora.getFullYear(), mes: agora.getMonth() + 1, dia: agora.getDate() }, regra);
  const prox = c.mes === 12 ? { ano: c.ano + 1, mes: 1 } : { ano: c.ano, mes: c.mes + 1 };
  return (
    <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)" }}>
      Fecha {diasAntes} dia{diasAntes === 1 ? "" : "s"} antes de cada vencimento. Próximo fechamento:{" "}
      <strong style={{ color: "var(--accent)" }}>{fmt(fechamentoDaFatura(regra, c))}</strong> (vence {fmt(vencimentoDaFatura(regra, c))}),
      depois {fmt(fechamentoDaFatura(regra, prox))} (vence {fmt(vencimentoDaFatura(regra, prox))}).
    </p>
  );
}
