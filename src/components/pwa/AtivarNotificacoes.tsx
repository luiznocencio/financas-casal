"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Bell, BellSlash } from "@phosphor-icons/react";

// VAPID public key (base64url) -> ArrayBuffer, como o PushManager exige.
function base64UrlParaBuffer(base64: string): ArrayBuffer {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buffer = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return buffer;
}

type Estado = "carregando" | "indisponivel" | "negado" | "ativo" | "inativo";

export function AtivarNotificacoes() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setEstado("indisponivel");
      return;
    }
    (async () => {
      if (Notification.permission === "denied") { setEstado("negado"); return; }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setEstado(sub ? "ativo" : "inativo");
      } catch {
        setEstado("inativo");
      }
    })();
  }, []);

  async function ativar() {
    setErro(null); setOcupado(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setEstado(perm === "denied" ? "negado" : "inativo"); return; }

      const chave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!chave) { setErro("Configuração de push ausente no servidor."); return; }

      await navigator.serviceWorker.register("/sw.js");
      const reg = await navigator.serviceWorker.ready;
      // reaproveita a assinatura existente (evita InvalidStateError ao re-subscrever)
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlParaBuffer(chave),
        }));
      const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } };
      const r = await fetch("/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify({
          subscription: { endpoint: j.endpoint, keys: j.keys },
          userAgent: navigator.userAgent,
        }),
      }).then((x) => x.json());
      if (!r.ok) { setErro("Não consegui salvar a assinatura. Tente de novo."); return; }
      setEstado("ativo");
    } catch {
      setErro("Não consegui ativar os avisos neste dispositivo.");
    } finally {
      setOcupado(false);
    }
  }

  async function desativar() {
    setErro(null); setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setEstado("inativo");
    } catch {
      setErro("Não consegui desativar. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  if (estado === "carregando" || estado === "indisponivel") return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        {estado === "ativo"
          ? <Bell size={18} weight="fill" color="var(--accent)" />
          : <BellSlash size={18} color="var(--muted)" />}
        <div className="min-w-0">
          <div className="text-sm font-medium text-[var(--text)]">Avisos de fatura fechando</div>
          <div className="text-xs text-[var(--muted)]">
            {estado === "ativo" && "Você recebe um aviso 1 dia antes de cada fatura fechar."}
            {estado === "inativo" && "Receba um aviso 1 dia antes de cada fatura fechar."}
            {estado === "negado" && "As notificações estão bloqueadas nas configurações do navegador."}
          </div>
          {erro && <div className="mt-1 text-xs text-[var(--negativo)]">{erro}</div>}
        </div>
      </div>
      {estado === "ativo" && (
        <Button variant="ghost" onClick={desativar} disabled={ocupado}>Desativar</Button>
      )}
      {estado === "inativo" && (
        <Button variant="primary" onClick={ativar} disabled={ocupado}>
          {ocupado ? "Ativando..." : "Ativar avisos"}
        </Button>
      )}
    </div>
  );
}
