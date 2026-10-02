import { and, eq } from "drizzle-orm";
import { getAdminUser } from "@/lib/admin";
import { getDb } from "@/db";
import { colaboradores, prestacoes } from "@/db/schema";
import { MUNICIPIOS_ES } from "@/lib/municipios-es";
import { TIPOS_MUDAS } from "@/lib/opcoes-atividades";

export const runtime="edge";

export async function POST(request:Request){
  if(!await getAdminUser())return Response.json({message:"ACESSO RESTRITO."},{status:403});
  try{
    const form=await request.formData();const competencia=String(form.get("competencia")||"");const authUserId=String(form.get("authUserId")||"");const data=String(form.get("data")||"");const municipio=String(form.get("municipio")||"");const tipoMuda=String(form.get("tipoMuda")||"");const quantidade=Number(form.get("quantidade")||0);const observacao=String(form.get("observacao")||"").trim();
    if(!/^\d{4}-\d{2}$/.test(competencia)||!/^\d{4}-\d{2}-\d{2}$/.test(data)||!MUNICIPIOS_ES.includes(municipio as typeof MUNICIPIOS_ES[number])||!TIPOS_MUDAS.includes(tipoMuda as typeof TIPOS_MUDAS[number])||quantidade<=0)return Response.json({message:"PREENCHA TODOS OS CAMPOS OBRIGATÓRIOS."},{status:400});
    const db=getDb();const colaborador=await db.query.colaboradores.findFirst({where:eq(colaboradores.authUserId,authUserId)});if(!colaborador?.associacao)return Response.json({message:"SELECIONE UM COLABORADOR COM ASSOCIAÇÃO CADASTRADA."},{status:400});
    const existente=await db.query.prestacoes.findFirst({where:and(eq(prestacoes.authUserId,authUserId),eq(prestacoes.competencia,competencia))});let atividades:Array<Record<string,unknown>>=[];try{atividades=existente?JSON.parse(existente.atividadesJson||"[]"):[];}catch{}
    atividades.push({executada:true,municipio,comunidade:"",propriedade:"",agricultor:"",telefone:"",tipoAtividade:"Entrega de mudas",tipoMuda,quantidadeMudas:String(quantidade),data,inicio:"00:00",duracao:"0",unidadeDuracao:"horas",resumo:observacao||`ENTREGA DE ${quantidade.toLocaleString("pt-BR")} MUDA(S) DE ${tipoMuda.toLocaleUpperCase("pt-BR")}.`,assinaturaProdutor:"",assinaturaTecnico:""});
    const agora=new Date().toISOString();const values={authUserId,competencia,municipio,associacao:colaborador.associacao,atividadesJson:JSON.stringify(atividades),totalMinutos:existente?.totalMinutos||0,anexosJson:existente?.anexosJson||"[]",observacoes:existente?.observacoes||null,status:"enviado",atualizadoEm:agora};
    await db.insert(prestacoes).values(values).onConflictDoUpdate({target:[prestacoes.authUserId,prestacoes.competencia],set:values});return Response.json({message:"ENTREGA DE MUDAS SALVA COM SUCESSO."});
  }catch(error){console.error("admin_entrega_mudas_error",error);return Response.json({message:"NÃO FOI POSSÍVEL SALVAR A ENTREGA DE MUDAS."},{status:500});}
}
