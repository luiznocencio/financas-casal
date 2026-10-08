import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next 16: "middleware" virou "proxy". Mantém a sessão do Supabase renovada.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // fora: estáticos (ícones, manifest, service worker, imagens) e rotas que não
  // usam a sessão do navegador (health, cron) — cada request aqui custava uma
  // checagem de login à toa
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest|js|map)$|manifest\.webmanifest|api/health|api/cron).*)",
  ],
};
