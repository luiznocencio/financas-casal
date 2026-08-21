import { createServerSupabase } from "@/lib/supabase/server";
import type { Member } from "@/lib/db/tipos";

export async function getMembroAtual(): Promise<Member | null> {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("members")
    .select("*")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  return (data as Member) ?? null;
}
