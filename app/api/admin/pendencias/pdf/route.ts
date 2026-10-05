import { getDb } from "@/db";
import { colaboradores, documentosAssociacao, planosTrabalho, prestacoes } from "@/db/schema";
import { getAdminUser } from "@/lib/admin";
import { listarNotasServicoPendentes } from "@/lib/notas-servico";
import { createPdf } from "@/lib/pdf";

export const runtime="edge";

export async function GET(request:Request){
  if(!await getAdminUser())return new Response("ACESSO RESTRITO",{status:403});
  const url=new URL(request.url);const solicitado=url.searchParams.get("tipo");const tipo=solicitado==="prestacao"?"prestacao":solicitado==="notas-servico"?"notas-servico":"plano";
  const competencias=url.searchParams.getAll("competencias").filter(c=>/^\d{4}-\d{2}$/.test(c));
  if(!competencias.length)return new Response("INFORME AO MENOS UMA COMPETÊNCIA",{status:400});
  const db=getDb();
  if(tipo==="notas-servico"){
    const [usuarios,documentos]=await Promise.all([db.select().from(colaboradores),db.select().from(documentosAssociacao)]);
    const pendentes=listarNotasServicoPendentes(usuarios,documentos,competencias);
    const associacoes=[...new Set(pendentes.map(item=>item.associacao))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
    const secoes=associacoes.map(associacao=>({heading:associacao,lines:pendentes.filter(item=>item.associacao===associacao).sort((a,b)=>a.nomeCompleto.localeCompare(b.nomeCompleto,"pt-BR")||a.competencia.localeCompare(b.competencia)).map(item=>`${item.nomeCompleto} · ${item.cargo} · COMPETÊNCIA ${item.competencia} · ${item.email}`)}));
    const pdf=await createPdf("PENDÊNCIAS DE NOTAS FISCAIS DE SERVIÇO",secoes.length?secoes:[{heading:"RESULTADO",lines:["NENHUMA NOTA FISCAL DE SERVIÇO PENDENTE NAS COMPETÊNCIAS SELECIONADAS."]}]);
    return new Response(pdf.buffer.slice(pdf.byteOffset,pdf.byteOffset+pdf.byteLength),{headers:{"content-type":"application/pdf","content-disposition":'attachment; filename="pendencias-notas-servico.pdf"'}});
  }
  const [usuarios,registros]=await Promise.all([db.select().from(colaboradores),tipo==="plano"?db.select().from(planosTrabalho):db.select().from(prestacoes)]);
  const enviados=new Set(registros.filter(r=>competencias.includes(r.competencia)).map(r=>`${r.authUserId}:${r.competencia}`));
  const secoes=competencias.flatMap(comp=>{const faltantes=usuarios.filter(u=>!enviados.has(`${u.authUserId}:${comp}`));return [{heading:`COMPETÊNCIA ${comp}`,lines:faltantes.length?faltantes.map(u=>`${u.nomeCompleto} · ${u.cargo} · ${u.associacao||"SEM ASSOCIAÇÃO"} · ${u.email}`):["NENHUMA PENDÊNCIA NESTA COMPETÊNCIA."]}];});
  const nome=tipo==="plano"?"PLANOS DE TRABALHO":"PRESTAÇÕES DE CONTAS";const pdf=await createPdf(`PENDÊNCIAS DE ${nome}`,secoes);
  return new Response(pdf.buffer.slice(pdf.byteOffset,pdf.byteOffset+pdf.byteLength),{headers:{"content-type":"application/pdf","content-disposition":`attachment; filename="pendencias-${tipo}.pdf"`}});
}
