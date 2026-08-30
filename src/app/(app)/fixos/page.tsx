import { redirect } from "next/navigation";

// Fundido em /planejamento (aba "Gastos fixos").
export default function FixosPage() {
  redirect("/planejamento?aba=fixos");
}
