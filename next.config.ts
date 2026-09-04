import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist não deve ser empacotado (usa ESM/dyn imports; roda no runtime node)
  serverExternalPackages: ["pdfjs-dist"],
  // o worker do pdfjs é carregado por import dinâmico (string) e não é rastreado
  // automaticamente — força a inclusão no bundle da função de importar PDF
  outputFileTracingIncludes: {
    "/api/importar/pdf": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    ],
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  async headers() {
    return [
      {
        // o service worker nunca pode ficar em cache, senão updates não chegam
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
