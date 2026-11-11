import {inArray} from "drizzle-orm";
import { ativoNaCompetencia } from "@/lib/vinculo-colaborador";
import { getDb } from "@/db";
import { colaboradores, documentosAssociacao, planosTrabalho, prestacoes } from "@/db/schema";
import { getAdminUser } from "@/lib/admin";
import { listarNotasServicoPendentes } from "@/lib/notas-servico";
import { normalizarNomeAssociacao } from "@/lib/nome-associacao";
import { createPdf } from "@/lib/pdf";

export const runtime="edge";

export async function GET(request:Request){
  if(!await getAdminUser())return new Response("ACESSO RESTRITO",{status:403});
  const url=new URL(request.url);const solicitado=url.searchParams.get("tipo");const tipo=solicitado==="prestacao"?"prestacao":solicitado==="notas-servico"?"notas-servico":"plano";
  const competencias=url.searchParams.getAll("competencias").filter(c=>/^\d{4}-\d{2}$/.test(c));
  if(!competencias.length)return new Response("INFORME AO MENOS UMA COMPETÊNCIA",{status:400});
  const filtro=url.searchParams.get("associacao");
  const colaborador=url.searchParams.get("colaborador");
  if(colaborador&&!/^[1-9]\d*$/.test(colaborador))return new Response("COLABORADOR INVÁLIDO",{status:400});
  const noFiltro=(nome:string,id:number)=>(!filtro||normalizarNomeAssociacao(nome)===normalizarNomeAssociacao(filtro))&&(!colaborador||String(id)===colaborador);
  const db=getDb();
  if(tipo==="notas-servico"){
    const [usuarios,documentos]=await Promise.all([db.select({id:colaboradores.id,authUserId:colaboradores.authUserId,nomeCompleto:colaboradores.nomeCompleto,nomeEmpresarial:colaboradores.nomeEmpresarial,mei:colaboradores.mei,email:colaboradores.email,cargo:colaboradores.cargo,associacao:colaboradores.associacao,associacoesJson:colaboradores.associacoesJson,dataAdmissao:colaboradores.dataAdmissao,dataSaida:colaboradores.dataSaida}).from(colaboradores),db.select({associacao:documentosAssociacao.associacao,competencia:documentosAssociacao.competencia,notasFiscaisJson:documentosAssociacao.notasFiscaisJson}).from(documentosAssociacao)]);
    const pendentes=listarNotasServicoPendentes(usuarios,documentos,competencias).filter(item=>noFiltro(item.associacao,item.id));
    const associacoes=[...new Set(pendentes.map(item=>item.associacao))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
    const secoes=associacoes.map(associacao=>({heading:associacao,lines:pendentes.filter(item=>item.associacao===associacao).sort((a,b)=>a.nomeCompleto.localeCompare(b.nomeCompleto,"pt-BR")||a.competencia.localeCompare(b.competencia)).map(item=>`${item.nomeCompleto} · ${item.cargo} · COMPETÊNCIA ${item.competencia} · ${item.email}`)}));
    const titulo="PENDÊNCIAS DE NOTAS FISCAIS DE SERVIÇO";
    if(url.searchParams.get("formato")==="json")return Response.json({titulo,secoes:secoes.length?secoes:[{heading:"RESULTADO",lines:["NENHUMA NOTA FISCAL DE SERVIÇO PENDENTE NAS COMPETÊNCIAS SELECIONADAS."]}],nomeArquivo:"pendencias-notas-servico.pdf"});
    const pdf=await createPdf(titulo,secoes.length?secoes:[{heading:"RESULTADO",lines:["NENHUMA NOTA FISCAL DE SERVIÇO PENDENTE NAS COMPETÊNCIAS SELECIONADAS."]}]);
    return new Response(pdf.buffer.slice(pdf.byteOffset,pdf.byteOffset+pdf.byteLength),{headers:{"content-type":"application/pdf","content-disposition":'attachment; filename="pendencias-notas-servico.pdf"'}});
  }
  const [usuarios,registros]=await Promise.all([db.select({id:colaboradores.id,authUserId:colaboradores.authUserId,nomeCompleto:colaboradores.nomeCompleto,nomeEmpresarial:colaboradores.nomeEmpresarial,mei:colaboradores.mei,email:colaboradores.email,cargo:colaboradores.cargo,associacao:colaboradores.associacao,associacoesJson:colaboradores.associacoesJson,dataAdmissao:colaboradores.dataAdmissao,dataSaida:colaboradores.dataSaida}).from(colaboradores),tipo==="plano"?db.select({authUserId:planosTrabalho.authUserId,competencia:planosTrabalho.competencia,associacao:planosTrabalho.associacao}).from(planosTrabalho).where(inArray(planosTrabalho.competencia,competencias)):db.select({authUserId:prestacoes.authUserId,competencia:prestacoes.competencia,associacao:prestacoes.associacao}).from(prestacoes).where(inArray(prestacoes.competencia,competencias))]);
  const chaveAssociacao=(valor:string|null|undefined)=>normalizarNomeAssociacao(valor||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Z0-9]/gi,"").toUpperCase();
  const associacoesDoUsuario=(usuario:typeof usuarios[number])=>{let lista:string[]=[];try{const dados=JSON.parse(usuario.associacoesJson||"[]");if(Array.isArray(dados))lista=dados.filter((item):item is string=>typeof item==="string"&&!!item.trim());}catch{}if(!lista.length&&usuario.associacao)lista=[usuario.associacao];return [...new Set(lista.map(normalizarNomeAssociacao).filter(Boolean))];};
  const enviados=new Set(registros.filter(r=>competencias.includes(r.competencia)).map(r=>`${r.authUserId}:${r.competencia}:${chaveAssociacao(r.associacao)}`));
  const pendentes=competencias.flatMap(competencia=>usuarios.filter(u=>ativoNaCompetencia(u,competencia)).flatMap(u=>associacoesDoUsuario(u).filter(associacao=>noFiltro(associacao,u.id)&&!enviados.has(`${u.authUserId}:${competencia}:${chaveAssociacao(associacao)}`)).map(associacao=>({...u,competencia,associacaoNormalizada:associacao}))));
  const associacoes=[...new Set(pendentes.map(item=>item.associacaoNormalizada))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const secoes=associacoes.map(associacao=>({heading:associacao,lines:pendentes.filter(item=>item.associacaoNormalizada===associacao).sort((a,b)=>a.nomeCompleto.localeCompare(b.nomeCompleto,"pt-BR")||a.competencia.localeCompare(b.competencia)).map(item=>`${item.nomeCompleto} · ${item.cargo} · COMPETÊNCIA ${item.competencia} · ${item.email}`)}));
  const nome=tipo==="plano"?"PLANOS DE TRABALHO":"PRESTAÇÕES DE CONTAS";const titulo=`PENDÊNCIAS DE ${nome} POR ASSOCIAÇÃO`;
  if(url.searchParams.get("formato")==="json")return Response.json({titulo,secoes:secoes.length?secoes:[{heading:"RESULTADO",lines:["NENHUMA PENDÊNCIA NAS COMPETÊNCIAS SELECIONADAS."]}],nomeArquivo:`pendencias-${tipo}.pdf`});
  const pdf=await createPdf(titulo,secoes.length?secoes:[{heading:"RESULTADO",lines:["NENHUMA PENDÊNCIA NAS COMPETÊNCIAS SELECIONADAS."]}]);
  return new Response(pdf.buffer.slice(pdf.byteOffset,pdf.byteOffset+pdf.byteLength),{headers:{"content-type":"application/pdf","content-disposition":`attachment; filename="pendencias-${tipo}.pdf"`}});
}
