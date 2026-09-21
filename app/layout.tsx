import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prestação de Contas | Arranjos Produtivos",
  description: "Portal de cadastro e prestação de contas dos colaboradores do Projeto Arranjos Produtivos.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
