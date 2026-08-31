import { redirect } from "next/navigation";

// Fundido em /planejamento (aba "Metas").
export default function MetasPage() {
  redirect("/planejamento?aba=metas");
}
