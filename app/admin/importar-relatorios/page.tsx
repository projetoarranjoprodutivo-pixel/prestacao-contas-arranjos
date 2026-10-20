import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import {getDb} from "@/db";
import {associacoes,colaboradores} from "@/db/schema";
import {eq} from "drizzle-orm";
import ImportadorPdf from "./importador-pdf";
import ImportadorRelatorios from "./importador-client";

export default async function ImportarRelatoriosPage() {
  const admin = await getAdminUser();
  if (!admin) redirect("/entrar-administracao");
  const db=getDb();
  const [pessoas,grupos]=await Promise.all([db.select({id:colaboradores.id,nomeCompleto:colaboradores.nomeCompleto,email:colaboradores.email,associacao:colaboradores.associacao,associacoesJson:colaboradores.associacoesJson}).from(colaboradores),db.select({nome:associacoes.nome}).from(associacoes).where(eq(associacoes.ativo,true))]);
  pessoas.sort((a,b)=>a.nomeCompleto.localeCompare(b.nomeCompleto,"pt-BR"));
  return (
    <main className="min-h-screen bg-slate-100 p-5 text-slate-950">
      <section className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-black text-emerald-800">ADMINISTRAÇÃO · ARRANJOS PRODUTIVOS</p>
        <h1 className="mt-2 text-3xl font-black">IMPORTAR RELATÓRIOS</h1>
        <p className="mt-2 text-sm text-slate-600">ENVIE OS PDFs DIRETAMENTE, CONFIRA A LEITURA E SALVE OS PLANOS E AS PRESTAÇÕES DE CONTAS.</p>
        <ImportadorPdf pessoas={pessoas} associacoes={grupos.map(g=>g.nome).sort()}/>
        <details className="mt-8 border-t pt-4"><summary className="cursor-pointer text-sm font-bold text-slate-600">Importação de pacotes preparados anteriormente (JSON/ZIP)</summary><ImportadorRelatorios /></details>
        <a className="mt-6 inline-block font-bold text-emerald-800" href="/admin">VOLTAR AO PAINEL</a>
      </section>
    </main>
  );
}
