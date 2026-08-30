"use client";
import { fechamentoDoVencimento } from "@/lib/financeiro/fechamento";

// Próxima ocorrência (>= hoje) de um dia do mês, com clamp de mês curto.
function proximaOcorrencia(dia: number): Date {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const y = hoje.getFullYear(), m = hoje.getMonth();
  const ultimo = (yy: number, mm: number) => new Date(yy, mm + 1, 0).getDate();
  let data = new Date(y, m, Math.min(dia, ultimo(y, m)));
  if (data < hoje) data = new Date(y, m + 1, Math.min(dia, ultimo(y, m + 1)));
  return data;
}
const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

// Mostra ao vivo qual será o próximo fechamento/vencimento, pra conferir o setup.
export function FechamentoPreview({ vencimento, diasAntes }: { vencimento: number; diasAntes: number }) {
  if (!(vencimento >= 1 && vencimento <= 31) || !(diasAntes >= 0 && diasAntes <= 27)) return null;
  const diaFech = fechamentoDoVencimento(vencimento, diasAntes);
  return (
    <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)" }}>
      Fecha todo dia <strong style={{ color: "var(--text)" }}>{diaFech}</strong>. Próximo fechamento:{" "}
      <strong style={{ color: "var(--accent)" }}>{fmt(proximaOcorrencia(diaFech))}</strong> · vence {fmt(proximaOcorrencia(vencimento))}.
    </p>
  );
}
