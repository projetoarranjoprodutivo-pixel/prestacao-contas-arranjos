import { getDb } from "@/db";
import { colaboradores, prestacoes } from "@/db/schema";
import { getAdminUser } from "@/lib/admin";
import { createPdf } from "@/lib/pdf";
import { inArray } from "drizzle-orm";

export const runtime="edge";

export async function GET(request:Request){
  if(!await getAdminUser())return new Response("Acesso restrito",{status:403});
  const params=new URL(request.url).searchParams;
  const recebidas=[...params.getAll("competencias"),...(params.get("competencia")?[params.get("competencia")!]:[])];
  const competencias=[...new Set(recebidas)].filter(valor=>/^\d{4}-\d{2}$/.test(valor)).sort();
  if(!competencias.length)return new Response("Competência inválida",{status:400});
  const db=getDb();const [registros,usuarios]=await Promise.all([db.select().from(prestacoes).where(inArray(prestacoes.competencia,competencias)),db.select().from(colaboradores)]);
  const nomes=new Map(usuarios.map(u=>[u.authUserId,u]));
  const sections=registros.flatMap((r,index)=>{const u=nomes.get(r.authUserId);const atividades=JSON.parse(r.atividadesJson) as Array<Record<string,string|boolean>>;return [{heading:`${index+1}. ${u?.nomeCompleto||"USUÁRIO"}`,lines:[`Competência: ${r.competencia}`,`Cargo: ${u?.cargo||"-"}`,`Associação: ${r.associacao}`,`Município principal: ${r.municipio}`,`Carga horária: ${(r.totalMinutos/60).toLocaleString("pt-BR",{maximumFractionDigits:2})} horas`,`Atividades: ${atividades.length}`,`Anexos: ${(JSON.parse(r.anexosJson||"[]") as unknown[]).length}`,`Observações: ${r.observacoes||"Sem observações"}`]},...atividades.map((a,i)=>({heading:`ATIVIDADE ${i+1}`,lines:[`${a.tipoAtividade||"Visita Técnica"} | Data: ${a.data||""} | Hora: ${a.inicio||""}`,`Município: ${a.municipio||""} | Comunidade: ${a.comunidade||""}`,...(a.tipoAtividade==="Entrega de mudas"?[`Tipo de mudas: ${a.tipoMuda||"Não informado"} | Quantidade: ${a.quantidadeMudas||"0"}`]:[`Agricultor: ${a.agricultor||""} | Propriedade: ${a.propriedade||""}`]),`Resultado: ${a.resumo||""}`]}))];});
  const rotulo=competencias.join("_");
  const pdf=await createPdf(`PRESTAÇÕES DE CONTAS - ${competencias.join(" · ")}`,sections.length?sections:[{heading:"SEM REGISTROS",lines:["Nenhuma prestação encontrada nas competências selecionadas."]}]);
  return new Response(pdf.buffer.slice(pdf.byteOffset,pdf.byteOffset+pdf.byteLength),{headers:{"content-type":"application/pdf","content-disposition":`attachment; filename="prestacoes-${rotulo}.pdf"`}});
}
