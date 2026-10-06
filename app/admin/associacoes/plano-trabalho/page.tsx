import {redirect} from "next/navigation";
import {eq} from "drizzle-orm";
import {getAdminUser} from "@/lib/admin";
import {getDb} from "@/db";
import {associacoes} from "@/db/schema";
import PlanoAssociacaoForm from "./plano-form";

export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{id?:string}>}){
 if(!await getAdminUser())redirect("/");const {id}=await searchParams;const numero=Number(id);if(!Number.isInteger(numero))redirect("/admin?aba=associacoes");const associacao=await getDb().query.associacoes.findFirst({where:eq(associacoes.id,numero)});if(!associacao)redirect("/admin?aba=associacoes");
 return <main className="min-h-screen bg-slate-100 p-5 text-slate-950"><section className="mx-auto max-w-6xl rounded-2xl border bg-white p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-black text-emerald-800">ADMINISTRAÇÃO · ASSOCIAÇÕES</p><h1 className="mt-2 text-3xl font-black">GERADOR DE PLANO DE TRABALHO</h1><p className="mt-2 text-sm text-slate-600">O DOCUMENTO SERÁ GERADO NO MESMO MODELO DO ARQUIVO OFICIAL.</p></div><a href="/admin?aba=associacoes" className="inline-flex h-11 items-center rounded-lg border border-emerald-800 px-4 text-sm font-black text-emerald-900">← VOLTAR PARA ASSOCIAÇÕES</a></div><PlanoAssociacaoForm associacao={{id:associacao.id,nome:associacao.nome,razaoSocial:associacao.razaoSocial||associacao.nome,municipiosJson:associacao.municipiosJson}}/></section></main>;
}
