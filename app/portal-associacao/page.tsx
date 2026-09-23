import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";
import { getDb } from "@/db";
import { garantirBanco } from "@/db/bootstrap";
import { associacoes, documentosAssociacao } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import DocumentosAssociacaoForm from "./documentos-form";
import { isAdminEmail } from "@/lib/admin";

export const dynamic="force-dynamic";

export default async function PortalAssociacao({searchParams}:{searchParams:Promise<{associacao?:string}>}){
  await garantirBanco();
  const user=await requireChatGPTUser("/portal-associacao");
  const superAdmin=isAdminEmail(user.email);
  if(user.role!=="associacao"&&!superAdmin)redirect("/");
  const db=getDb();
  const lista=superAdmin?await db.select().from(associacoes).where(eq(associacoes.ativo,true)).orderBy(associacoes.nome):[];
  const params=await searchParams;
  const solicitada=String(params.associacao||"");
  const associacao=superAdmin?(lista.some(item=>item.nome===solicitada)?solicitada:lista[0]?.nome||""):user.associacao||"";
  if(!associacao&&!superAdmin)redirect("/");
  const envios=associacao?await db.select().from(documentosAssociacao).where(eq(documentosAssociacao.associacao,associacao)).orderBy(desc(documentosAssociacao.competencia)):[];
  return <main className="min-h-screen bg-slate-100 text-slate-900"><header className="bg-[#123b2a] text-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10"><Building2 className="h-6 w-6"/></span><div><p className="font-bold">PORTAL DA ASSOCIAÇÃO</p><p className="text-sm text-emerald-100">{associacao||"ACESSO GERAL"}</p></div></div><div className="flex gap-2">{superAdmin&&<a href="/admin" className="rounded-lg border border-white/30 px-4 py-2 text-sm font-bold">ADMINISTRAÇÃO</a>}<a href={chatGPTSignOutPath("/")} className="rounded-lg border border-white/30 px-4 py-2 text-sm font-bold">SAIR</a></div></div></header><div className="mx-auto max-w-5xl px-5 py-8">{superAdmin&&<form className="mb-6 rounded-2xl border bg-white p-5 shadow-sm"><label className="text-sm font-bold">SELECIONE A ASSOCIAÇÃO<div className="mt-2 flex flex-col gap-2 sm:flex-row"><select name="associacao" defaultValue={associacao} className="h-12 flex-1 rounded-xl border border-slate-300 bg-white px-4">{lista.map(item=><option key={item.id} value={item.nome}>{item.nome}</option>)}</select><button className="h-12 rounded-xl bg-emerald-700 px-6 font-bold text-white">ACESSAR</button></div></label></form>}{associacao?<><DocumentosAssociacaoForm associacao={associacao}/><section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">ENVIOS REALIZADOS</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="py-2">COMPETÊNCIA</th><th>EXTRATOS</th><th>NOTAS FISCAIS</th><th>ATUALIZAÇÃO</th></tr></thead><tbody>{envios.map(item=>{let extratos:unknown[]=[];let notas:unknown[]=[];try{extratos=JSON.parse(item.extratosJson)}catch{}try{notas=JSON.parse(item.notasFiscaisJson)}catch{}return <tr key={item.id} className="border-b"><td className="py-3 font-bold">{item.competencia}</td><td>{extratos.length}</td><td>{notas.length}</td><td>{item.atualizadoEm.slice(0,10).split("-").reverse().join("/")}</td></tr>})}{!envios.length&&<tr><td colSpan={4} className="py-8 text-center text-slate-500">NENHUM DOCUMENTO ENVIADO.</td></tr>}</tbody></table></div></section></>:<p className="rounded-2xl border bg-white p-8 text-center font-bold">CADASTRE UMA ASSOCIAÇÃO ATIVA PARA UTILIZAR ESTE PORTAL.</p>}</div></main>;
}
