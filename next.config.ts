import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist e xlsx não devem ser empacotados (dyn imports internos; rodam no
  // runtime node) — resolvidos de node_modules em tempo de execução
  serverExternalPackages: ["pdfjs-dist", "xlsx"],
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
