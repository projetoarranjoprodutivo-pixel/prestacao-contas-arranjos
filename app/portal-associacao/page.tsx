import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";
import { getDb } from "@/db";
import { garantirBanco } from "@/db/bootstrap";
import { documentosAssociacao } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import DocumentosAssociacaoForm from "./documentos-form";

export const dynamic="force-dynamic";

export default async function PortalAssociacao(){
  await garantirBanco();
  const user=await requireChatGPTUser("/portal-associacao");
  if(user.role!=="associacao"||!user.associacao)redirect("/");
  const envios=await getDb().select().from(documentosAssociacao).where(eq(documentosAssociacao.authUserId,user.userId)).orderBy(desc(documentosAssociacao.competencia));
  return <main className="min-h-screen bg-slate-100 text-slate-900"><header className="bg-[#123b2a] text-white"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10"><Building2 className="h-6 w-6"/></span><div><p className="font-bold">PORTAL DA ASSOCIAÇÃO</p><p className="text-sm text-emerald-100">{user.associacao}</p></div></div><a href={chatGPTSignOutPath("/")} className="rounded-lg border border-white/30 px-4 py-2 text-sm font-bold">SAIR</a></div></header><div className="mx-auto max-w-5xl px-5 py-8"><DocumentosAssociacaoForm associacao={user.associacao}/><section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">ENVIOS REALIZADOS</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="py-2">COMPETÊNCIA</th><th>EXTRATOS</th><th>NOTAS FISCAIS</th><th>ATUALIZAÇÃO</th></tr></thead><tbody>{envios.map(item=>{let extratos:unknown[]=[];let notas:unknown[]=[];try{extratos=JSON.parse(item.extratosJson)}catch{}try{notas=JSON.parse(item.notasFiscaisJson)}catch{}return <tr key={item.id} className="border-b"><td className="py-3 font-bold">{item.competencia}</td><td>{extratos.length}</td><td>{notas.length}</td><td>{item.atualizadoEm.slice(0,10).split("-").reverse().join("/")}</td></tr>})}{!envios.length&&<tr><td colSpan={4} className="py-8 text-center text-slate-500">NENHUM DOCUMENTO ENVIADO.</td></tr>}</tbody></table></div></section></div></main>;
}
