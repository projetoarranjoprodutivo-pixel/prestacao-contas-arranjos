import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import ImportadorRelatorios from "./importador-client";

export default async function ImportarRelatoriosPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/entrar-administracao");
  return (
    <main className="min-h-screen bg-slate-100 p-5 text-slate-950">
      <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-black text-emerald-800">ADMINISTRAÇÃO · ARRANJOS PRODUTIVOS</p>
        <h1 className="mt-2 text-3xl font-black">IMPORTAR RELATÓRIOS HISTÓRICOS</h1>
        <p className="mt-2 text-sm text-slate-600">ENVIE O ARQUIVO JSON PREPARADO E OS PDFs DE FOTOS E LISTAS DE PRESENÇA.</p>
        <ImportadorRelatorios />
        <a className="mt-6 inline-block font-bold text-emerald-800" href="/admin">VOLTAR AO PAINEL</a>
      </section>
    </main>
  );
}
