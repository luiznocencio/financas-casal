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
