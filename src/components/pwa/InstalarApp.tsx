"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

// Evento do Chrome/Android que permite disparar o prompt nativo de instalação.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const CHAVE_DISPENSADO = "pwa-install-dispensado";

function jaInstalado(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function InstalarApp() {
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [podeInstalar, setPodeInstalar] = useState(false); // Android/desktop: prompt nativo disponível
  const [ehIOS, setEhIOS] = useState(false);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    // registra o service worker (necessário pro app ser instalável no Android)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    if (jaInstalado()) return;

    let dispensado = false;
    try {
      dispensado = localStorage.getItem(CHAVE_DISPENSADO) === "1";
    } catch {
      /* localStorage indisponível — segue mostrando */
    }
    if (dispensado) return;

    const ua = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
    // no iOS só o Safari instala (add à tela inicial); Chrome/Firefox iOS não têm o menu
    const safariIOS = ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (safariIOS) {
      setEhIOS(true);
      setVisivel(true);
    }

    function onBeforeInstall(e: Event) {
      e.preventDefault(); // guarda o evento pra disparar quando o usuário clicar
      promptRef.current = e as BeforeInstallPromptEvent;
      setPodeInstalar(true);
      setVisivel(true);
    }
    function onInstalado() {
      setVisivel(false);
      promptRef.current = null;
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalado);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalado);
    };
  }, []);

  function dispensar() {
    setVisivel(false);
    try {
      localStorage.setItem(CHAVE_DISPENSADO, "1");
    } catch {
      /* sem persistência: só some nesta sessão */
    }
  }

  async function instalar() {
    const ev = promptRef.current;
    if (!ev) return;
    await ev.prompt();
    await ev.userChoice;
    promptRef.current = null;
    setPodeInstalar(false);
    setVisivel(false);
  }

  if (!visivel) return null;

  return (
    <div
      role="dialog"
      aria-label="Instalar o app"
      style={{
        position: "fixed", left: 0, right: 0,
        bottom: "calc(64px + env(safe-area-inset-bottom))",
        zIndex: 45, padding: "0 12px", pointerEvents: "none",
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          maxWidth: 560, margin: "0 auto",
          display: "flex", alignItems: "center", gap: 12,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "12px 14px",
          boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
        }}
      >
        <img src="/icon-192.png" alt="" width={40} height={40} style={{ borderRadius: 10, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, color: "var(--text)", fontSize: "0.92rem" }}>
            Instalar o Finanças do Casal
          </div>
          {ehIOS ? (
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>
              Toque em <strong>Compartilhar</strong> e depois em{" "}
              <strong>Adicionar à Tela de Início</strong>.
            </div>
          ) : (
            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>
              Abre direto da tela inicial, como um app.
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {podeInstalar && (
            <Button variant="primary" onClick={instalar}>Instalar</Button>
          )}
          <Button variant="quiet" onClick={dispensar} aria-label="Dispensar">
            {ehIOS ? "Ok" : "Agora não"}
          </Button>
        </div>
      </div>
    </div>
  );
}
