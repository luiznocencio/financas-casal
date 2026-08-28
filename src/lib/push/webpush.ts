import webpush from "web-push";

let configurado = false;

function configurar() {
  if (configurado) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error("Chaves VAPID ausentes");
  webpush.setVapidDetails("mailto:falecomoluizneto@gmail.com", pub, priv);
  configurado = true;
}

export type Assinatura = { endpoint: string; p256dh: string; auth: string };

export type ResultadoEnvio = { ok: boolean; expirada: boolean };

/** Envia uma notificação. `expirada` = a assinatura sumiu (404/410) e deve ser apagada. */
export async function enviarPush(
  assinatura: Assinatura,
  payload: { title: string; body: string; url?: string; tag?: string },
): Promise<ResultadoEnvio> {
  configurar();
  try {
    await webpush.sendNotification(
      { endpoint: assinatura.endpoint, keys: { p256dh: assinatura.p256dh, auth: assinatura.auth } },
      JSON.stringify(payload),
    );
    return { ok: true, expirada: false };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    return { ok: false, expirada: status === 404 || status === 410 };
  }
}
