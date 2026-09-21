import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { colaboradores, planosTrabalho } from "@/db/schema";
import { and, eq } from "drizzle-orm";
export const runtime="edge";
type Item={data:string;hora:string;municipio:string;comunidade:string;propriedade:string;agricultor:string;telefone:string;tipoAtividade:string;tipoMuda:string;quantidadeMudas:string;observacao:string};
const tipos=new Set(["Visita Técnica","Dias de Campo","Seminário","Entrega de mudas"]);
export async function GET(request:Request){const user=await getChatGPTUser();if(!user)return Response.json({message:"Sessão expirada."},{status:401});const competencia=new URL(request.url).searchParams.get("competencia")||"";if(!/^\d{4}-\d{2}$/.test(competencia))return Response.json({message:"Competência inválida."},{status:400});const plano=await getDb().query.planosTrabalho.findFirst({where:and(eq(planosTrabalho.authUserId,user.userId),eq(planosTrabalho.competencia,competencia))});return plano?Response.json({encontrado:true,agenda:JSON.parse(plano.agendaJson)}):Response.json({encontrado:false,agenda:[]});}
export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({message:"Sessão expirada."},{status:401});
  try{
    const form=await request.formData();const db=getDb();
    const cadastro=await db.query.colaboradores.findFirst({where:eq(colaboradores.authUserId,user.userId)});
    if(!cadastro?.associacao)return Response.json({message:"Atualize seu cadastro e selecione a associação."},{status:403});
    const competencia=String(form.get("competencia")||"");let agenda:Item[]=[];try{agenda=JSON.parse(String(form.get("agenda")||"[]"));}catch{}
    if(!/^\d{4}-\d{2}$/.test(competencia)||!agenda.length||agenda.some(i=>!i.data||!i.hora||!i.municipio||!tipos.has(i.tipoAtividade)||(i.tipoAtividade==="Visita Técnica"&&(!i.comunidade||!i.propriedade||!i.agricultor||!i.telefone))||(i.tipoAtividade==="Entrega de mudas"&&(!i.tipoMuda||Number(i.quantidadeMudas)<=0))))return Response.json({message:"Preencha a competência e todos os campos obrigatórios da agenda."},{status:400});
    const values={authUserId:user.userId,competencia,associacao:cadastro.associacao,agendaJson:JSON.stringify(agenda),status:"enviado",atualizadoEm:new Date().toISOString()};
    await db.insert(planosTrabalho).values(values).onConflictDoUpdate({target:[planosTrabalho.authUserId,planosTrabalho.competencia],set:values});
    return Response.json({message:"Plano de trabalho salvo com sucesso."});
  }catch(error){console.error("plano_error",error);return Response.json({message:"Não foi possível salvar o plano. Tente novamente."},{status:500});}
}
