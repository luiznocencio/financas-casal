// Gera os ícones PNG do PWA a partir do mesmo desenho do favicon (src/app/icon.svg).
// Rode com: node scripts/gen-pwa-icons.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const teal = "#0e9aa7", orange = "#e8833a";

// full-bleed (maskable / apple): a divisão preenche o quadrado todo, R$ centralizado na zona segura
const fullBleed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="32" height="64" fill="${teal}"/>
  <rect x="32" width="32" height="64" fill="${orange}"/>
  <text x="32" y="41" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" fill="#ffffff" text-anchor="middle">R$</text>
</svg>`;

// arredondado (ícone comum da home, igual ao favicon)
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><clipPath id="r"><rect width="64" height="64" rx="14"/></clipPath></defs>
  <g clip-path="url(#r)">
    <rect width="32" height="64" fill="${teal}"/>
    <rect x="32" width="32" height="64" fill="${orange}"/>
    <text x="32" y="44" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="700" fill="#ffffff" text-anchor="middle">R$</text>
  </g>
</svg>`;

async function png(svg, size, out) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out);
  console.log("wrote", path.relative(raiz, out));
}

await png(rounded, 192, path.join(raiz, "public", "icon-192.png"));
await png(rounded, 512, path.join(raiz, "public", "icon-512.png"));
await png(fullBleed, 512, path.join(raiz, "public", "icon-maskable-512.png"));
await png(fullBleed, 180, path.join(raiz, "src", "app", "apple-icon.png"));
