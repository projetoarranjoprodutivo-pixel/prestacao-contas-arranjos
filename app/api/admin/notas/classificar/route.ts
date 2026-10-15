import {and,eq,sql} from "drizzle-orm";
import {getAderesOrAdminUser} from "@/lib/admin";
import {getDb} from "@/db";
import {documentosAssociacao} from "@/db/schema";
export const runtime="edge";
export async function POST(request:Request){
 if(!await getAderesOrAdminUser())return Response.json({message:"ACESSO NEGADO."},{status:403});
 try{
  const {key,categoriaNota}=await request.json() as {key?:string;categoriaNota?:string};
  if(typeof key!=="string"||!key||!["mudas","servico","outras","automatico"].includes(categoriaNota||""))return Response.json({message:"CLASSIFICAÇÃO INVÁLIDA."},{status:400});
  const db=getDb();
  const registros=await db.select({id:documentosAssociacao.id,notasFiscaisJson:documentosAssociacao.notasFiscaisJson}).from(documentosAssociacao).where(sql`instr(${documentosAssociacao.notasFiscaisJson}, ${key}) > 0`);
  for(const registro of registros){
   const notas=JSON.parse(registro.notasFiscaisJson) as Array<Record<string,unknown>>;
   const nota=notas.find(item=>item.key===key);if(!nota)continue;
   if(categoriaNota==="automatico")delete nota.categoriaNota;else nota.categoriaNota=categoriaNota;
   const alterados=await db.update(documentosAssociacao).set({notasFiscaisJson:JSON.stringify(notas),atualizadoEm:new Date().toISOString()}).where(and(eq(documentosAssociacao.id,registro.id),eq(documentosAssociacao.notasFiscaisJson,registro.notasFiscaisJson))).returning({id:documentosAssociacao.id});
   if(!alterados.length)return Response.json({message:"A NOTA FOI ALTERADA. ATUALIZE A PÁGINA E TENTE NOVAMENTE."},{status:409});
   return Response.json({message:"CLASSIFICAÇÃO SALVA."});
  }
  return Response.json({message:"NOTA NÃO ENCONTRADA."},{status:404});
 }catch{return Response.json({message:"NÃO FOI POSSÍVEL CLASSIFICAR A NOTA."},{status:500});}
}
