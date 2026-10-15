import {env} from "cloudflare:workers";
import {getChatGPTUser} from "@/app/chatgpt-auth";
import {isAdminEmail} from "@/lib/admin";
import {getDb} from "@/db";
import {documentosAssociacao} from "@/db/schema";
import {eq} from "drizzle-orm";

export const runtime="edge";

export async function GET(request:Request){
  const user=await getChatGPTUser();
  if(!user||(user.role!=="aderes"&&user.role!=="admin"&&user.role!=="associacao"&&!isAdminEmail(user.email)))return new Response("ACESSO NEGADO.",{status:403});
  const key=new URL(request.url).searchParams.get("key")||"";
  if(!key.startsWith("associacoes-financeiro/")&&!key.startsWith("prestacoes/"))return new Response("ARQUIVO INVÁLIDO.",{status:400});
  if(user.role==="associacao"){
    if(!user.associacao)return new Response("ACESSO NEGADO.",{status:403});
    const registros=await getDb().select().from(documentosAssociacao).where(eq(documentosAssociacao.associacao,user.associacao));
    const autorizado=registros.some(item=>[item.extratosJson,item.notasFiscaisJson].some(json=>{try{return (JSON.parse(json||"[]") as Array<{key?:string}>).some(arquivo=>arquivo.key===key)}catch{return false}}));
    if(!autorizado)return new Response("ACESSO NEGADO.",{status:403});
  }
  const arquivo=await env.BUCKET.get(key,"stream");
  if(!arquivo)return new Response("ARQUIVO NÃO ENCONTRADO.",{status:404});
  const nome=key.split("/").pop()?.replace(/^[0-9a-f-]+-/i,"")||"documento";
  const tipo=nome.toLowerCase().endsWith(".pdf")?"application/pdf":nome.toLowerCase().endsWith(".png")?"image/png":"image/jpeg";
  return new Response(arquivo,{headers:{"Content-Type":tipo,"Content-Disposition":`inline; filename="${nome.replace(/["\r\n]/g,"")}"`,"Cache-Control":"private, max-age=300"}});
}
