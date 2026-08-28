// Imagem ilustrativa da meta, escolhida por palavras-chave do nome.
// URLs diretas do Unsplash (source.unsplash foi descontinuado); todos os IDs
// abaixo foram verificados (respondem 200). Sem API key, sem rate limit.
const MAPA: { termos: string[]; id: string }[] = [
  { termos: ["praia", "mar ", "beach", "ilha", "litoral"], id: "photo-1507525428034-b723cf961d3e" },
  { termos: ["viagem", "viajar", "trip", "férias", "ferias", "passeio", "turismo", "mundo", "europa"], id: "photo-1488646953014-85cb44e25828" },
  { termos: ["carro", "moto", "veículo", "veiculo", "automóvel", "automovel"], id: "photo-1503376780353-7e6692767b70" },
  // casamento ANTES de casa: "casamento" contém "casa" (senão pegaria a imagem errada)
  { termos: ["casamento", "noiva", "noivo", "wedding"], id: "photo-1519741497674-611481863552" },
  { termos: ["casa", "apartamento", "imóvel", "imovel", "reforma", "mudança", "mudanca"], id: "photo-1560518883-ce09059eeffa" },
  { termos: ["notebook", "computador", "celular", "iphone", "eletrônico", "eletronico", "setup", "tech"], id: "photo-1517336714731-489689fd1ca8" },
  { termos: ["reserva", "emergência", "emergencia", "poupança", "poupanca", "fundo", "investir", "investimento"], id: "photo-1579621970563-ebec7560ff3e" },
  { termos: ["montanha", "trilha", "aventura", "camping", "natureza"], id: "photo-1506905925346-21bda4d32df4" },
];
const PADRAO = "photo-1441974231531-c6227db76b6e"; // verde/floresta, calmo

export function imagemDaMeta(nome: string): string {
  const n = ` ${(nome ?? "").toLowerCase()} `;
  const achado = MAPA.find((m) => m.termos.some((t) => n.includes(t)));
  return `https://images.unsplash.com/${achado?.id ?? PADRAO}?w=800&h=280&fit=crop&q=70`;
}
