import { getDb } from "@/db";
import { colaboradores, planosTrabalho, prestacoes } from "@/db/schema";
import { getAdminUser } from "@/lib/admin";
import { createPdf } from "@/lib/pdf";

export const runtime="edge";

export async function GET(request:Request){
  if(!await getAdminUser())return new Response("ACESSO RESTRITO",{status:403});
  const url=new URL(request.url);const tipo=url.searchParams.get("tipo")==="prestacao"?"prestacao":"plano";
  const competencias=url.searchParams.getAll("competencias").filter(c=>/^\d{4}-\d{2}$/.test(c));
  if(!competencias.length)return new Response("INFORME AO MENOS UMA COMPETÊNCIA",{status:400});
  const db=getDb();const [usuarios,registros]=await Promise.all([db.select().from(colaboradores),tipo==="plano"?db.select().from(planosTrabalho):db.select().from(prestacoes)]);
  const enviados=new Set(registros.filter(r=>competencias.includes(r.competencia)).map(r=>`${r.authUserId}:${r.competencia}`));
  const secoes=competencias.flatMap(comp=>{const faltantes=usuarios.filter(u=>!enviados.has(`${u.authUserId}:${comp}`));return [{heading:`COMPETÊNCIA ${comp}`,lines:faltantes.length?faltantes.map(u=>`${u.nomeCompleto} · ${u.cargo} · ${u.associacao||"SEM ASSOCIAÇÃO"} · ${u.email}`):["NENHUMA PENDÊNCIA NESTA COMPETÊNCIA."]}];});
  const nome=tipo==="plano"?"PLANOS DE TRABALHO":"PRESTAÇÕES DE CONTAS";const pdf=await createPdf(`PENDÊNCIAS DE ${nome}`,secoes);
  return new Response(pdf.buffer.slice(pdf.byteOffset,pdf.byteOffset+pdf.byteLength),{headers:{"content-type":"application/pdf","content-disposition":`attachment; filename="pendencias-${tipo}.pdf"`}});
}
