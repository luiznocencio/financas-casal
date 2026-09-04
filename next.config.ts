import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist não deve ser empacotado (usa ESM/dyn imports; roda no runtime node)
  serverExternalPackages: ["pdfjs-dist"],
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
