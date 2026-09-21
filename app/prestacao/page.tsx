import { redirect } from "next/navigation";
import { requireChatGPTUser } from "../chatgpt-auth";
import { getDb } from "@/db";
import { associacoes, colaboradores } from "@/db/schema";
import { eq } from "drizzle-orm";
import PrestacaoForm from "./prestacao-form";
export const dynamic = "force-dynamic";
export default async function PrestacaoPage(){ const user=await requireChatGPTUser("/prestacao"); const db=getDb();let cadastro; try{cadastro=await db.query.colaboradores.findFirst({where:eq(colaboradores.authUserId,user.userId)});}catch{cadastro=null;} if(!cadastro||!cadastro.associacao)redirect("/cadastro"); if(new Date(cadastro.documentoValidade+"T23:59:59")<new Date())redirect("/cadastro"); let agricultores=[];try{agricultores=JSON.parse(cadastro.atendimentosJson||"[]");}catch{}const associacao=await db.query.associacoes.findFirst({where:eq(associacoes.nome,cadastro.associacao)});let municipios:string[]=[];try{municipios=JSON.parse(associacao?.municipiosJson||"[]");}catch{} return <PrestacaoForm nome={cadastro.nomeCompleto} cargo={cadastro.cargo} associacao={cadastro.associacao} agricultores={agricultores} municipios={municipios}/>; }
