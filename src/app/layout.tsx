import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
// números (valores em R$): Poppins, com algarismos tabulares via .mono no CSS
const numeros = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-num", display: "swap" });

export const metadata: Metadata = {
  title: "Finanças do Casal",
  description: "Gerenciador financeiro do casal — contas, cartões, orçamento e metas.",
  applicationName: "Finanças do Casal",
  appleWebApp: { title: "Finanças do Casal", capable: true, statusBarStyle: "default" },
};

export const viewport = {
  themeColor: "#3b5bdb",
  width: "device-width",
  initialScale: 1,
  // trava o auto-zoom do iOS ao focar campos e o zoom por duplo-toque
  // (o iOS ainda permite pinça manual por acessibilidade)
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${numeros.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
