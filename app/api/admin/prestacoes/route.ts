import {env} from "cloudflare:workers";
import {eq} from "drizzle-orm";
import {getDb} from "@/db";
import {prestacoes} from "@/db/schema";
import {getAdminUser} from "@/lib/admin";

export const runtime="edge";

type Anexo={key?:string};

export async function DELETE(request:Request){
  if(!await getAdminUser())return Response.json({message:"ACESSO NÃO AUTORIZADO."},{status:403});
  const id=Number(new URL(request.url).searchParams.get("id"));
  if(!Number.isInteger(id)||id<=0)return Response.json({message:"PRESTAÇÃO INVÁLIDA."},{status:400});
  try{
    const db=getDb();
    const registro=await db.query.prestacoes.findFirst({where:eq(prestacoes.id,id)});
    if(!registro)return Response.json({message:"PRESTAÇÃO NÃO ENCONTRADA."},{status:404});
    let anexos:Anexo[]=[];
    try{anexos=JSON.parse(registro.anexosJson||"[]");}catch{}
    await db.delete(prestacoes).where(eq(prestacoes.id,id));
    if(env.BUCKET){
      await Promise.all(anexos.filter(anexo=>anexo?.key).map(anexo=>env.BUCKET.delete(anexo.key!)));
    }
    return Response.json({message:"PRESTAÇÃO E SEUS ANEXOS FORAM EXCLUÍDOS."});
  }catch(error){
    console.error("admin_excluir_prestacao",error);
    return Response.json({message:"NÃO FOI POSSÍVEL EXCLUIR A PRESTAÇÃO."},{status:500});
  }
}
