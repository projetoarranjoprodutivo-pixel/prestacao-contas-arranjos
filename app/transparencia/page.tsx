import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import PainelTransparencia from "./painel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Transparência | Arranjos Produtivos",
  description: "Consulta administrativa aos resultados do Projeto Arranjos Produtivos.",
  robots: { index: false, follow: false },
};

export default async function Transparencia() {
  if (!await getAdminUser()) redirect("/entrar-administracao?destino=transparencia");
  return <PainelTransparencia/>;
}
