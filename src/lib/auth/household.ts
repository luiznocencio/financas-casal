import { cache } from "react";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Member } from "@/lib/db/tipos";

// Id do usuário logado. `getClaims` confere a ASSINATURA do token (chaves ES256
// do projeto, JWKS em cache) sem ir ao servidor de Auth a cada request — o
// `getUser` fazia uma ida e volta de rede por chamada, e eram várias por página.
// `cache` = uma vez por request (layout, página e componentes compartilham).
export const getUsuarioId = cache(async (): Promise<string | null> => {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub;
});

export const getMembroAtual = cache(async (): Promise<Member | null> => {
  const userId = await getUsuarioId();
  if (!userId) return null;
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("members")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as Member) ?? null;
});
