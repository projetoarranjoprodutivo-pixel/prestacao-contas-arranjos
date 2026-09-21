import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../chatgpt-auth";
import { getDb } from "@/db";
import { associacoes, colaboradores } from "@/db/schema";
import { eq } from "drizzle-orm";
import PlanoForm from "./plano-form";
export const dynamic="force-dynamic";
export default async function PlanoPage(){const user=await requireChatGPTUser("/plano");const db=getDb();let cadastro;try{cadastro=await db.query.colaboradores.findFirst({where:eq(colaboradores.authUserId,user.userId)});}catch{cadastro=null;}if(!cadastro?.associacao)redirect("/cadastro");let agricultores=[];try{agricultores=JSON.parse(cadastro.atendimentosJson||"[]");}catch{}const associacao=await db.query.associacoes.findFirst({where:eq(associacoes.nome,cadastro.associacao)});let municipios:string[]=[];try{municipios=JSON.parse(associacao?.municipiosJson||"[]");}catch{}return <PlanoForm nome={cadastro.nomeCompleto} cargo={cadastro.cargo} associacao={cadastro.associacao} agricultores={agricultores} municipios={municipios}/>;}
