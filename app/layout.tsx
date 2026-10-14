import type { Metadata } from "next";
import "./globals.css";
import OfflineManager from "./offline-manager";

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
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}<OfflineManager/></body>
    </html>
  );
}
