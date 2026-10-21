import {env} from "cloudflare:workers";
import {eq} from "drizzle-orm";
import {getAdminUser} from "@/lib/admin";
import {getDb} from "@/db";
import {associacoes} from "@/db/schema";
export const runtime="edge";
type Documento={key:string;nome:string;tipo:string;tamanho:number;categoria?:string;sha256?:string};
function lista(json:string|null):Documento[]{try{const dados=JSON.parse(json||"[]");return Array.isArray(dados)?dados:[];}catch{return [];}}
export async function POST(request:Request){
 if(!await getAdminUser())return Response.json({message:"Acesso restrito."},{status:403});
 try{
  if(!env.BUCKET)throw new Error("Armazenamento indisponível.");
  const form=await request.formData();const id=Number(form.get("id"));
  const a=await getDb().query.associacoes.findFirst({where:eq(associacoes.id,id)});
  if(!a)return Response.json({message:"Associação não encontrada."},{status:404});
  const arquivo=form.get("arquivo");
  if(!(arquivo instanceof File)||!arquivo.size||arquivo.size>20*1024*1024)throw new Error("Selecione um PDF de até 20 MB.");
  const bytes=await arquivo.arrayBuffer();if(new TextDecoder().decode(bytes.slice(0,5))!=="%PDF-")throw new Error("O arquivo deve ser um PDF válido.");
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(x=>x.toString(16).padStart(2,"0")).join("");
  const docs=lista(a.documentosJson);
  if(docs.some(d=>d.categoria==="termo-fomento"&&d.sha256===hash))return Response.json({message:"Este termo já está cadastrado."});
  const key=`associacoes/${id}/termos/${crypto.randomUUID()}.pdf`;
  await env.BUCKET.put(key,bytes);
  docs.push({key,nome:arquivo.name,tipo:"application/pdf",tamanho:arquivo.size,categoria:"termo-fomento",sha256:hash});
  await getDb().update(associacoes).set({documentosJson:JSON.stringify(docs)}).where(eq(associacoes.id,id));
  return Response.json({message:"Termo de fomento cadastrado."});
 }catch(e){return Response.json({message:e instanceof Error?e.message:"Não foi possível salvar o termo."},{status:400});}
}
export async function GET(request:Request){
 if(!await getAdminUser())return new Response("Acesso restrito.",{status:403});
 if(!env.BUCKET)return new Response("Armazenamento indisponível.",{status:503});
 const url=new URL(request.url);const id=Number(url.searchParams.get("id"));const key=url.searchParams.get("key");
 const a=await getDb().query.associacoes.findFirst({where:eq(associacoes.id,id)});
 const doc=lista(a?.documentosJson||null).find(d=>d.key===key&&d.categoria==="termo-fomento");
 if(!doc)return new Response("Termo não encontrado.",{status:404});
 const bytes=await env.BUCKET.get(doc.key,"stream");if(!bytes)return new Response("Arquivo não encontrado.",{status:404});
 return new Response(bytes,{headers:{"Content-Type":"application/pdf","Content-Disposition":`inline; filename="termo-fomento-${id}.pdf"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
