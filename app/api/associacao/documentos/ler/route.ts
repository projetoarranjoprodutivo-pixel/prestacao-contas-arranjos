import {env} from "cloudflare:workers";
import {eq} from "drizzle-orm";
import {getChatGPTUser} from "@/app/chatgpt-auth";
import {getDb} from "@/db";
import {garantirBanco} from "@/db/bootstrap";
import {associacoes} from "@/db/schema";
import {isAdminEmail} from "@/lib/admin";

export const runtime="edge";

type AiBinding={
 toMarkdown:(arquivo:{name:string;blob:Blob},opcoes?:unknown)=>Promise<{data?:string;format?:string;error?:string}|Array<{data?:string;format?:string;error?:string}>>;
 run:(modelo:string,entrada:unknown)=>Promise<unknown>;
};

function jsonResposta(valor:unknown){
 const objeto=valor as {response?:string;result?:{response?:string}};
 const texto=objeto?.response||objeto?.result?.response||JSON.stringify(valor);
 const trecho=texto.match(/\{[\s\S]*\}/)?.[0]||"{}";
 try{return JSON.parse(trecho) as Record<string,unknown>}catch{return {}}
}

function textoResultado(valor:Awaited<ReturnType<AiBinding["toMarkdown"]>>){
 const item=Array.isArray(valor)?valor[0]:valor;
 if(!item||item.format==="error"||item.error)throw new Error(item?.error||"NÃO FOI POSSÍVEL LER O DOCUMENTO.");
 return item.data||"";
}

export async function POST(request:Request){
 await garantirBanco();
 const user=await getChatGPTUser();
 const permitido=!!user&&(user.role==="associacao"||user.role==="admin"||user.role==="aderes"||isAdminEmail(user.email));
 if(!permitido)return Response.json({message:"ACESSO NÃO AUTORIZADO."},{status:403});
 try{
  const form=await request.formData();
  const arquivo=form.get("arquivo");
  if(!(arquivo instanceof File)||!arquivo.size)return Response.json({message:"ARQUIVO NÃO INFORMADO."},{status:400});
  if(arquivo.size>10*1024*1024)return Response.json({message:"O ARQUIVO DEVE TER NO MÁXIMO 10 MB."},{status:400});
  if(!["application/pdf","image/jpeg","image/png"].includes(arquivo.type))return Response.json({message:"FORMATO NÃO PERMITIDO."},{status:400});
  const ai=(env as unknown as {AI:AiBinding}).AI;
  if(!ai)throw new Error("A LEITURA AUTOMÁTICA AINDA NÃO ESTÁ HABILITADA.");
  const conversao=await ai.toMarkdown({name:arquivo.name,blob:new Blob([await arquivo.arrayBuffer()],{type:arquivo.type})},{conversionOptions:{image:{descriptionLanguage:"pt"},pdf:{metadata:false},output:{format:"text"}}});
  const conteudo=textoResultado(conversao).slice(0,60000);
  if(!conteudo.trim())throw new Error("NÃO FOI POSSÍVEL ENCONTRAR TEXTO NO DOCUMENTO.");
  const db=getDb();
  const lista=await db.select({nome:associacoes.nome,razaoSocial:associacoes.razaoSocial,cnpj:associacoes.cnpj}).from(associacoes).where(eq(associacoes.ativo,true));
  const resposta=await ai.run("@cf/zai-org/glm-4.7-flash",{messages:[
   {role:"system",content:"Extraia dados de uma nota fiscal brasileira. Responda SOMENTE JSON válido, sem markdown. Não invente. Campos: descricao (descrição principal dos produtos ou serviços, texto curto), quantidade (soma ou quantidade principal como texto), valor (valor total da nota apenas em número decimal com ponto), dataEmissao (AAAA-MM-DD), associacao (nome exato de uma associação da lista, somente se houver evidência), competencia (AAAA-MM, normalmente o mês da emissão)."},
   {role:"user",content:`NOME DO ARQUIVO: ${arquivo.name}\nASSOCIAÇÕES POSSÍVEIS: ${JSON.stringify(lista)}\nCONTEÚDO EXTRAÍDO:\n${conteudo}`}
  ],max_tokens:700,temperature:0});
  const dados=jsonResposta(resposta);
  return Response.json({
   descricao:String(dados.descricao||""),quantidade:String(dados.quantidade||""),valor:String(dados.valor||"").replace(",","."),
   dataEmissao:String(dados.dataEmissao||""),associacao:String(dados.associacao||""),competencia:String(dados.competencia||"")
  });
 }catch(error){return Response.json({message:error instanceof Error?error.message:"NÃO FOI POSSÍVEL LER O DOCUMENTO."},{status:500})}
}
