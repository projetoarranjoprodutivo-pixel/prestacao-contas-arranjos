import { getDb } from "@/db";
import { colaboradores, prestacoes } from "@/db/schema";
import { getAdminUser } from "@/lib/admin";
import { createPdf } from "@/lib/pdf";
import { eq } from "drizzle-orm";

export const runtime="edge";

export async function GET(request:Request){
  if(!await getAdminUser())return new Response("Acesso restrito",{status:403});
  const competencia=new URL(request.url).searchParams.get("competencia")||"";
  if(!/^\d{4}-\d{2}$/.test(competencia))return new Response("Competência inválida",{status:400});
  const db=getDb();const [registros,usuarios]=await Promise.all([db.select().from(prestacoes).where(eq(prestacoes.competencia,competencia)),db.select().from(colaboradores)]);
  const nomes=new Map(usuarios.map(u=>[u.authUserId,u]));
  const sections=registros.flatMap((r,index)=>{const u=nomes.get(r.authUserId);const atividades=JSON.parse(r.atividadesJson) as Array<Record<string,string|boolean>>;return [{heading:`${index+1}. ${u?.nomeCompleto||"USUÁRIO"}`,lines:[`Cargo: ${u?.cargo||"-"}`,`Associação: ${r.associacao}`,`Município principal: ${r.municipio}`,`Carga horária: ${r.totalMinutos} minutos`,`Atividades: ${atividades.length}`,`Anexos: ${(JSON.parse(r.anexosJson||"[]") as unknown[]).length}`,`Observações: ${r.observacoes||"Sem observações"}`]},...atividades.map((a,i)=>({heading:`ATIVIDADE ${i+1}`,lines:[`${a.tipoAtividade||"Visita Técnica"} | Data: ${a.data||""} | Hora: ${a.inicio||""}`,`Município: ${a.municipio||""} | Comunidade: ${a.comunidade||""}`,...(a.tipoAtividade==="Entrega de mudas"?[`Tipo de mudas: ${a.tipoMuda||"Não informado"} | Quantidade: ${a.quantidadeMudas||"0"}`]:[`Agricultor: ${a.agricultor||""} | Propriedade: ${a.propriedade||""}`]),`Resultado: ${a.resumo||""}`]}))];});
  const pdf=createPdf(`PRESTAÇÕES DE CONTAS - ${competencia}`,sections.length?sections:[{heading:"SEM REGISTROS",lines:["Nenhuma prestação encontrada nesta competência."]}]);
  return new Response(pdf,{headers:{"content-type":"application/pdf","content-disposition":`attachment; filename="prestacoes-${competencia}.pdf"`}});
}
