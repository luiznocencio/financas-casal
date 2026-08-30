import { redirect } from "next/navigation";

// Fundido em /planejamento (aba "A receber").
export default function AReceberPage() {
  redirect("/planejamento?aba=receber");
}
