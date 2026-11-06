import {env} from "cloudflare:workers";
import {and,eq,sql} from "drizzle-orm";
import {getAderesOrAdminUser} from "@/lib/admin";
import {getDb} from "@/db";
import {documentosAssociacao} from "@/db/schema";
import {POST as lerDocumento} from "@/app/api/associacao/documentos/ler/route";
import {categoriaDaNota} from "@/lib/classificacao-notas";
export const runtime="edge";
export async function POST(request:Request){
 if(!await getAderesOrAdminUser())return Response.json({message:"ACESSO NEGADO."},{status:403});
 try{
  const {key}=await request.json() as {key?:string};
  if(typeof key!=="string"||!key)return Response.json({message:"SELECIONE UMA NOTA PARA RELER O CONTEÚDO."},{status:400});
  const db=getDb();const registros=await db.select().from(documentosAssociacao).where(sql`instr(${documentosAssociacao.notasFiscaisJson}, ${key}) > 0`);
  for(const registro of registros){
   const notas=JSON.parse(registro.notasFiscaisJson) as Array<Record<string,unknown>>;const nota=notas.find(n=>n.key===key);if(!nota)continue;
   const objeto=await env.BUCKET.get(key);if(!objeto)return Response.json({message:"ARQUIVO ORIGINAL NÃO ENCONTRADO."},{status:404});
   const form=new FormData();form.set("arquivo",new File([await objeto.arrayBuffer()],String(nota.nome||"nota.pdf"),{type:String(nota.tipo||"application/pdf")}));
   const resposta=await lerDocumento(new Request(request.url,{method:"POST",body:form}));const lidos=await resposta.json() as Record<string,string>;
   if(!resposta.ok)return Response.json(lidos,{status:resposta.status});
   if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(lidos.competencia)||(!lidos.prestador&&!lidos.cnpjPrestador))return Response.json({message:"O CONTEÚDO NÃO IDENTIFICOU PRESTADOR E COMPETÊNCIA COM SEGURANÇA. CONFIRA O DOCUMENTO."},{status:422});
   Object.assign(nota,lidos,{origemLeitura:"conteudo",relidoEm:new Date().toISOString()});nota.categoriaNota=categoriaDaNota({descricao:lidos.descricao});
   const alterados=await db.update(documentosAssociacao).set({notasFiscaisJson:JSON.stringify(notas),atualizadoEm:new Date().toISOString()}).where(and(eq(documentosAssociacao.id,registro.id),eq(documentosAssociacao.notasFiscaisJson,registro.notasFiscaisJson))).returning({id:documentosAssociacao.id});
   if(!alterados.length)return Response.json({message:"DOCUMENTO ALTERADO POR OUTRO ACESSO. ATUALIZE A PÁGINA."},{status:409});
   return Response.json({message:`CONTEÚDO RELIDO. ${lidos.prestador||lidos.cnpjPrestador} · COMPETÊNCIA ${lidos.competencia}. ${lidos.aviso||""}`});
  }
  return Response.json({message:"NOTA NÃO ENCONTRADA."},{status:404});
 }catch(error){console.error("releitura_nota",error);return Response.json({message:"NÃO FOI POSSÍVEL RELER A NOTA. O CADASTRO ANTERIOR FOI PRESERVADO."},{status:500});}
}
