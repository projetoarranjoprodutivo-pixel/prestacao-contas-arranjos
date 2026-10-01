import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { colaboradores, prestacoes } from "@/db/schema";
import { getAdminUser } from "@/lib/admin";
import { MUNICIPIOS_ES } from "@/lib/municipios-es";

export async function POST(request:Request){
 if(!await getAdminUser())return Response.json({message:"ACESSO RESTRITO."},{status:403});
 const f=await request.formData();const authUserId=String(f.get("authUserId")||""),competencia=String(f.get("competencia")||""),data=String(f.get("data")||""),municipio=String(f.get("municipio")||""),tipoMuda=String(f.get("tipoMuda")||""),quantidade=Number(f.get("quantidade")),observacao=String(f.get("observacao")||"");
 if(!authUserId||!/^\d{4}-\d{2}$/.test(competencia)||!/^\d{4}-\d{2}-\d{2}$/.test(data)||!MUNICIPIOS_ES.includes(municipio as typeof MUNICIPIOS_ES[number])||!tipoMuda||!Number.isInteger(quantidade)||quantidade<1)return Response.json({message:"PREENCHA TODOS OS DADOS DA ENTREGA."},{status:400});
 const db=getDb();const colaborador=await db.query.colaboradores.findFirst({where:eq(colaboradores.authUserId,authUserId)});if(!colaborador?.associacao)return Response.json({message:"O COLABORADOR PRECISA TER UMA ASSOCIAÇÃO CADASTRADA."},{status:400});
 const existente=await db.query.prestacoes.findFirst({where:and(eq(prestacoes.authUserId,authUserId),eq(prestacoes.competencia,competencia))});let atividades:Array<Record<string,unknown>>=[];try{atividades=JSON.parse(existente?.atividadesJson||"[]");}catch{}
 atividades.push({id:crypto.randomUUID(),data,inicio:"",fim:"",duracao:0,tipoAtividade:"Entrega de mudas",municipio,tipoMuda,quantidadeMudas:quantidade,observacao,resumo:observacao,executada:true});const agora=new Date().toISOString();
 if(existente)await db.update(prestacoes).set({atividadesJson:JSON.stringify(atividades),atualizadoEm:agora}).where(eq(prestacoes.id,existente.id));else await db.insert(prestacoes).values({authUserId,competencia,municipio,associacao:colaborador.associacao,atividadesJson:JSON.stringify(atividades),totalMinutos:0,anexosJson:"[]",observacoes:"ENTREGA DE MUDAS INCLUÍDA PELO PAINEL ADMINISTRATIVO.",status:"enviado",criadoEm:agora,atualizadoEm:agora});
 return Response.json({message:"ENTREGA DE MUDAS SALVA COM SUCESSO."});
}
