// Service worker mínimo do PWA "Finanças do Casal".
// Só existe para tornar o app instalável (o Chrome no Android exige um SW
// com handler de fetch). NÃO fazemos cache: é um app de dinheiro e servir
// telas/saldos velhos seria pior que uma tela de carregamento. Todo request
// passa direto pela rede (não chamamos respondWith).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // passthrough: sem respondWith, o browser faz o fetch normal pela rede.
});

// Web Push: mostra a notificação de fatura fechando.
self.addEventListener("push", (event) => {
  let dados = { title: "Finanças do Casal", body: "", url: "/cartoes", tag: "fatura" };
  try {
    if (event.data) dados = { ...dados, ...event.data.json() };
  } catch {
    /* payload não-JSON: usa o padrão */
  }
  event.waitUntil(
    self.registration.showNotification(dados.title, {
      body: dados.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: dados.url },
      // tag por cartão: notificações de cartões diferentes não se sobrepõem
      tag: dados.tag,
    }),
  );
});

// Ao tocar na notificação: foca uma aba aberta do app ou abre uma nova.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((abas) => {
      for (const aba of abas) {
        if ("focus" in aba) {
          aba.navigate(destino);
          return aba.focus();
        }
      }
      return self.clients.openWindow(destino);
    }),
  );
});
