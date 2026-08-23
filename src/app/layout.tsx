import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Finanças do Casal",
  description: "Gerenciador financeiro do casal — contas, cartões, orçamento e metas.",
  applicationName: "Finanças do Casal",
  appleWebApp: { title: "Finanças do Casal", capable: true, statusBarStyle: "default" },
};

export const viewport = { themeColor: "#3b5bdb" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
