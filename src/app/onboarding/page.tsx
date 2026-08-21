import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMembroAtual } from "@/lib/auth/household";
import { OnboardingForm } from "@/components/onboarding/OnboardingForm";

export default async function OnboardingPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // já tem lar? vai direto pro app
  const membro = await getMembroAtual();
  if (membro) redirect("/");

  const nomeSugerido = user.email?.split("@")[0] ?? "Eu";
  return <OnboardingForm nomeSugerido={nomeSugerido} />;
}
