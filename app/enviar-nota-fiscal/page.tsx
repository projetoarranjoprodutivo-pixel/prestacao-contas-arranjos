import { redirect } from "next/navigation";
import { ReceiptText } from "lucide-react";
import { eq } from "drizzle-orm";
import { requireChatGPTUser } from "../chatgpt-auth";
import { getDb } from "@/db";
import { colaboradores } from "@/db/schema";
import NotaFiscalForm from "./nota-fiscal-form";

export const dynamic = "force-dynamic";

export default async function EnviarNotaFiscalPage() {
  const user = await requireChatGPTUser("/enviar-nota-fiscal");
  const cadastro = await getDb().query.colaboradores.findFirst({
    where: eq(colaboradores.authUserId, user.userId),
  });
  if (!cadastro?.associacao) redirect("/painel");
  const coordenadorGeral = cadastro.cargo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === "coordenador geral";
  let associacoes: string[] = [];
  try { associacoes = JSON.parse(cadastro.associacoesJson || "[]"); } catch {}
  if (!associacoes.length) associacoes = [cadastro.associacao];

  return <main className="min-h-screen bg-slate-100 text-slate-900">
    <header className="bg-[#123b2a] text-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3"><ReceiptText className="h-6 w-6"/><div><p className="font-bold">ENVIO DE NOTA FISCAL</p><p className="text-sm text-emerald-100">{cadastro.associacao}</p></div></div>
        <div className="flex flex-wrap gap-2">{coordenadorGeral&&<a href="/coordenacao/mudas" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-black text-slate-950">GESTÃO DE MUDAS</a>}<a href="/painel" className="rounded-lg border border-white/30 px-4 py-2 text-sm font-bold">VOLTAR AO PAINEL</a></div>
      </div>
    </header>
    <div className="mx-auto max-w-4xl px-5 py-8"><NotaFiscalForm associacao={cadastro.associacao} associacoes={associacoes}/></div>
  </main>;
}
