import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { getDb } from "@/db";
import { colaboradores } from "@/db/schema";
import EntregaMudasForm from "./form";

export const dynamic = "force-dynamic";

export default async function EntregaMudasPage({searchParams}:{searchParams:Promise<{competencia?:string}>}){
  const admin=await getAdminUser();if(!admin)redirect("/");
  const params=await searchParams;
  const competencia=/^\d{4}-\d{2}$/.test(params.competencia||"")?params.competencia!:new Date().toISOString().slice(0,7);
  const tecnicos=(await getDb().select().from(colaboradores)).sort((a,b)=>a.nomeCompleto.localeCompare(b.nomeCompleto));
  return <main className="min-h-screen bg-slate-100 p-5 text-slate-950"><section className="mx-auto max-w-4xl rounded-2xl border bg-white p-6 shadow-sm"><p className="text-sm font-black text-emerald-800">ADMINISTRAÇÃO · ARRANJOS PRODUTIVOS</p><h1 className="mt-2 text-3xl font-black">INCLUIR ENTREGA DE MUDAS</h1><p className="mt-2 text-sm text-slate-600">A ENTREGA SERÁ INCLUÍDA NA PRESTAÇÃO DE CONTAS DO COLABORADOR E NO RESUMO ADMINISTRATIVO.</p><EntregaMudasForm competenciaInicial={competencia} colaboradores={tecnicos.map(item=>({id:item.authUserId,nome:item.nomeCompleto,associacao:item.associacao||""}))}/><a href={`/admin?aba=resumo&competencias=${competencia}`} className="mt-6 inline-block font-bold text-emerald-800">VOLTAR AO RESUMO E MUDAS</a></section></main>;
}
