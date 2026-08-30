import { redirect } from "next/navigation";

// Fundido em /planejamento (aba "Contas a pagar").
export default function ContasPagarPage() {
  redirect("/planejamento?aba=contas");
}
