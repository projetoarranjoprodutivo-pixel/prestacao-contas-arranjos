import {env} from "cloudflare:workers";
import {getChatGPTUser} from "@/app/chatgpt-auth";
import {isAdminEmail} from "@/lib/admin";

export const runtime="edge";

export async function GET(request:Request){
  const user=await getChatGPTUser();
  if(!user||!isAdminEmail(user.email))return new Response("ACESSO NEGADO.",{status:403});
  const key=new URL(request.url).searchParams.get("key")||"";
  if(!key.startsWith("associacoes-financeiro/"))return new Response("ARQUIVO INVÁLIDO.",{status:400});
  const arquivo=await env.BUCKET.get(key,"stream");
  if(!arquivo)return new Response("ARQUIVO NÃO ENCONTRADO.",{status:404});
  const nome=key.split("/").pop()?.replace(/^[0-9a-f-]+-/i,"")||"documento";
  const tipo=nome.toLowerCase().endsWith(".pdf")?"application/pdf":nome.toLowerCase().endsWith(".png")?"image/png":"image/jpeg";
  return new Response(arquivo,{headers:{"Content-Type":tipo,"Content-Disposition":`inline; filename="${nome.replace(/["\r\n]/g,"")}"`,"Cache-Control":"private, max-age=300"}});
}
