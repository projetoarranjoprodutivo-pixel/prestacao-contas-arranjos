import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { colaboradores, planosTrabalho, prestacoes } from "@/db/schema";
import { and, eq } from "drizzle-orm";
export const runtime="edge";
type Atividade={executada:boolean;municipio:string;comunidade:string;propriedade:string;agricultor:string;telefone:string;tipoAtividade:string;tipoMuda:string;quantidadeMudas:string;data:string;inicio:string;duracao:string;resumo:string};

export async function GET(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({message:"Sessão expirada."},{status:401});
  const competencia=new URL(request.url).searchParams.get("competencia")||"";if(!/^\d{4}-\d{2}$/.test(competencia))return Response.json({message:"Competência inválida."},{status:400});
  const db=getDb();const [existente,plano]=await Promise.all([
    db.query.prestacoes.findFirst({where:and(eq(prestacoes.authUserId,user.userId),eq(prestacoes.competencia,competencia))}),
    db.query.planosTrabalho.findFirst({where:and(eq(planosTrabalho.authUserId,user.userId),eq(planosTrabalho.competencia,competencia))}),
  ]);
  const converter=(a:Record<string,string>)=>({executada:true,municipio:a.municipio||"",comunidade:a.comunidade||"",propriedade:a.propriedade||"",agricultor:a.agricultor||"",telefone:a.telefone||"",tipoAtividade:a.tipoAtividade||"Visita Técnica",tipoMuda:a.tipoMuda||"",quantidadeMudas:a.quantidadeMudas||"",data:a.data||"",inicio:a.hora||"",duracao:"",resumo:a.observacao||""});
  if(existente){
    const atividades=JSON.parse(existente.atividadesJson) as Atividade[];
    const agenda=plano?JSON.parse(plano.agendaJson) as Array<Record<string,string>>:[];
    const chave=(a:{data?:string;inicio?:string;tipoAtividade?:string;municipio?:string;agricultor?:string})=>[a.data,a.inicio,a.tipoAtividade,a.municipio,a.agricultor].join("|");
    const existentes=new Set(atividades.map(chave));
    const novas=agenda.map(converter).filter(a=>!existentes.has(chave(a)));
    return Response.json({origem:"prestacao",municipio:existente.municipio,atividades:[...atividades,...novas],atividadesNovas:novas.length,observacoes:existente.observacoes||"",anexos:JSON.parse(existente.anexosJson||"[]")});
  }
  if(!plano)return Response.json({origem:"vazio",municipio:"",atividades:[],observacoes:"",anexos:[]});
  const agenda=JSON.parse(plano.agendaJson) as Array<Record<string,string>>;
  return Response.json({origem:"plano",municipio:agenda[0]?.municipio||"",atividades:agenda.map(converter),observacoes:"",anexos:[]});
}

export async function POST(request:Request){
  const user=await getChatGPTUser(); if(!user)return Response.json({message:"Sessão expirada. Entre novamente."},{status:401});
  try{
    const form=await request.formData(); const db=getDb();
    const cadastro=await db.query.colaboradores.findFirst({where:eq(colaboradores.authUserId,user.userId)});
    if(!cadastro?.associacao)return Response.json({message:"Atualize seu cadastro e selecione a associação antes de enviar a prestação."},{status:403});
    if(new Date(cadastro.documentoValidade+"T23:59:59")<new Date())return Response.json({message:"Atualize os documentos de identificação vencidos antes de continuar."},{status:403});
    const competencia=String(form.get("competencia")||""); const associacao=cadastro.associacao;
    let atividades:Atividade[]=[]; try{atividades=JSON.parse(String(form.get("atividades")||"[]"));}catch{}
    const municipio=atividades[0]?.municipio||"";
    if(!/^\d{4}-\d{2}$/.test(competencia)||!atividades.length)return Response.json({message:"Preencha a competência e pelo menos uma atividade."},{status:400});
    const atividadeInvalida=atividades.findIndex(a=>!a.municipio||!a.tipoAtividade||!a.data||!a.inicio||(a.tipoAtividade==="Visita Técnica"&&(!a.comunidade||!a.propriedade||!a.agricultor||!a.telefone))||(a.tipoAtividade==="Entrega de mudas"&&(!a.tipoMuda||Number(a.quantidadeMudas)<=0))||(a.executada&&(Number(a.duracao)<=0||!a.resumo))||(!a.executada&&!a.resumo));
    if(atividadeInvalida>=0)return Response.json({message:`Revise a atividade ${atividadeInvalida+1}: preencha todos os campos obrigatórios, a duração e o resumo da execução.`},{status:400});
    const existente=await db.query.prestacoes.findFirst({where:and(eq(prestacoes.authUserId,user.userId),eq(prestacoes.competencia,competencia))});
    let anexos:Array<{key:string;nome:string;tipo:string}>=[];try{anexos=existente?JSON.parse(existente.anexosJson||"[]"):[];}catch{anexos=[];}
    if(!env.BUCKET)throw new Error("Armazenamento KV indisponível");
    const permitidos=new Set(["application/pdf","image/jpeg","image/png","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
    for(const entrada of form.getAll("anexos")){
      if(typeof entrada==="string")continue;
      const item=entrada as File;
      if(!item.size)continue;
      if(item.size>20*1024*1024)return Response.json({message:`O arquivo ${item.name} ultrapassa 20 MB.`},{status:400});
      if(!permitidos.has(item.type))return Response.json({message:`Formato não permitido: ${item.name}. Use PDF, JPG, PNG, Word ou Excel.`},{status:400});
      const key=`prestacoes/${user.userId}/${competencia}/${crypto.randomUUID()}-${item.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
      await env.BUCKET.put(key,await item.arrayBuffer(),{metadata:{contentType:item.type}});
      anexos.push({key,nome:item.name,tipo:item.type});
    }
    const values={authUserId:user.userId,competencia,municipio,associacao,atividadesJson:JSON.stringify(atividades),totalMinutos:atividades.filter(a=>a.executada).reduce((s,a)=>s+Number(a.duracao||0),0),anexosJson:JSON.stringify(anexos),observacoes:String(form.get("observacoes")||"").trim()||null,status:"enviado",atualizadoEm:new Date().toISOString()};
    await db.insert(prestacoes).values(values).onConflictDoUpdate({target:[prestacoes.authUserId,prestacoes.competencia],set:values});
    return Response.json({message:`Prestação de contas salva com ${anexos.length} anexo(s).`,anexos});
  }catch(error){console.error("prestacao_error",error);return Response.json({message:"Não foi possível salvar a prestação. Tente novamente."},{status:500});}
}
