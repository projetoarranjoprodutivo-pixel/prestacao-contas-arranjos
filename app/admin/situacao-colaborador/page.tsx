import {redirect} from "next/navigation";
import {eq} from "drizzle-orm";
import {getAdminUser} from "@/lib/admin";
import {getDb} from "@/db";
import {colaboradores} from "@/db/schema";
import SituacaoDocumental from "@/app/painel/situacao-documental";
export const dynamic="force-dynamic";
export default async function ConferirSituacao({searchParams}:{searchParams:Promise<{id?:string;ano?:string}>}){
 if(!await getAdminUser())redirect("/entrar-administracao");
 const p=await searchParams,id=Number(p.id);if(!Number.isSafeInteger(id)||id<=0)redirect("/admin?aba=usuarios");
 const cadastro=await getDb().query.colaboradores.findFirst({where:eq(colaboradores.id,id)});if(!cadastro)redirect("/admin?aba=usuarios");
 return <main className="min-h-screen bg-[#f4f7f3] p-5 text-slate-900"><div className="mx-auto max-w-6xl"><a href="/admin?aba=usuarios" className="font-bold text-emerald-800">Voltar aos colaboradores</a><p className="mt-5 text-sm font-bold text-emerald-800">CONFERÊNCIA ADMINISTRATIVA</p><h1 className="mt-1 text-2xl font-bold">{cadastro.nomeCompleto}</h1><SituacaoDocumental cadastro={cadastro} ano={p.ano} colaboradorId={cadastro.id}/></div></main>;
}
