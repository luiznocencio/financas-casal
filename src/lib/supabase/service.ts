import { createClient } from "@supabase/supabase-js";

// Cliente com service_role: IGNORA RLS. Só pode ser usado no servidor, em
// rotas de background (cron) sem sessão de usuário. NUNCA importar no client.
export function createServiceSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
