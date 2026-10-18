// Gera os ícones das notificações push (um por tipo de aviso), com o desenho
// "fill" do Phosphor — o mesmo pacote de ícones do app.
//   public/notif/<tipo>.png       → ícone colorido (aparece ao lado do texto)
//   public/notif/<tipo>-badge.png → silhueta branca (barra de status do Android)
// Rode com: node scripts/gen-notif-icons.mjs
import sharp from "sharp";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const saida = path.join(raiz, "public", "notif");
mkdirSync(saida, { recursive: true });

const TIPOS = [
  { tipo: "fatura", icone: "CreditCard", cor: "#0e9aa7" },
  { tipo: "conta", icone: "CalendarCheck", cor: "#e8833a" },
  { tipo: "orcamento-atencao", icone: "ChartPieSlice", cor: "#d99a00" },
  { tipo: "orcamento-vai-passar", icone: "TrendUp", cor: "#e06a2c" },
  { tipo: "orcamento-estourou", icone: "Warning", cor: "#d64545" },
  { tipo: "geral", icone: "Bell", cor: "#0e9aa7" },
];

// extrai os <path d="..."> da variante "fill" do def do Phosphor
function pathsFill(nome) {
  const src = readFileSync(path.join(raiz, "node_modules/@phosphor-icons/react/dist/defs", `${nome}.es.js`), "utf8");
  const bloco = src.split('"fill"')[1].split(/\[\s*"light"/)[0];
  return [...bloco.matchAll(/d: "([^"]+)"/g)].map((m) => m[1]);
}

for (const { tipo, icone, cor } of TIPOS) {
  const glifo = pathsFill(icone).map((d) => `<path d="${d}" fill="#ffffff"/>`).join("");
  const colorido = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <rect width="256" height="256" rx="56" fill="${cor}"/>
  <g transform="translate(48 48) scale(0.625)">${glifo}</g>
</svg>`;
  const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">${glifo}</svg>`;
  await sharp(Buffer.from(colorido)).resize(192, 192).png().toFile(path.join(saida, `${tipo}.png`));
  await sharp(Buffer.from(badge)).resize(96, 96).png().toFile(path.join(saida, `${tipo}-badge.png`));
  console.log("wrote", `public/notif/${tipo}.png`, "+ badge");
}
