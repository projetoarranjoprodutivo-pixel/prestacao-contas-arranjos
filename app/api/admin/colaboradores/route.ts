import { dataSaidaValida } from "@/lib/vinculo-colaborador";
import {eq} from "drizzle-orm";
import {getDb} from "@/db";
import {colaboradores,planosTrabalho,prestacoes,associacoes as tabelaAssociacoes} from "@/db/schema";
import {getAdminUser} from "@/lib/admin";
export const runtime="edge";
const texto=(valor:unknown)=>String(valor||"").trim();
export async function PATCH(request:Request){if(!await getAdminUser())return Response.json({message:"ACESSO NÃO AUTORIZADO."},{status:403});try{const dados=await request.json() as Record<string,unknown>;const id=Number(dados.id);if(!Number.isInteger(id))return Response.json({message:"COLABORADOR INVÁLIDO."},{status:400});const associacoes=Array.isArray(dados.associacoes)?dados.associacoes.map(texto).filter(Boolean):[];const municipios=Array.isArray(dados.municipios)?dados.municipios.map(texto).filter(Boolean):[];const values={nomeCompleto:texto(dados.nomeCompleto),email:texto(dados.email).toLowerCase(),cargo:texto(dados.cargo),associacao:associacoes[0]||null,associacoesJson:JSON.stringify(associacoes),municipiosAtendidosJson:JSON.stringify(municipios),mei:texto(dados.mei)||null,nomeEmpresarial:texto(dados.nomeEmpresarial)||null,cftaCrea:texto(dados.cftaCrea)||null,documentoValidade:texto(dados.documentoValidade),dataAdmissao:texto(dados.dataAdmissao)||"2026-03-17",...(dados.dataSaida!==undefined?{dataSaida:texto(dados.dataSaida)||null}:{}),atualizadoEm:new Date().toISOString()};if(!values.nomeCompleto||!values.email||!values.cargo)return Response.json({message:"INFORME NOME, E-MAIL E CARGO."},{status:400});if(!dataSaidaValida(texto(dados.dataSaida),values.dataAdmissao))return Response.json({message:"INFORME UMA DATA DE SAÍDA VÁLIDA, IGUAL OU POSTERIOR À ADMISSÃO."},{status:400});const db=getDb();
if(dados.corrigirHistorico===true){
 if(associacoes.length!==1)return Response.json({message:"PARA CORRIGIR O HISTÓRICO, INFORME UMA ÚNICA ASSOCIAÇÃO."},{status:400});
 const atual=await db.query.colaboradores.findFirst({where:eq(colaboradores.id,id)});
 if(!atual)return Response.json({message:"COLABORADOR NÃO ENCONTRADO."},{status:404});
 const destino=await db.select({nome:tabelaAssociacoes.nome}).from(tabelaAssociacoes).where(eq(tabelaAssociacoes.nome,associacoes[0])).limit(1);
 if(!destino.length)return Response.json({message:"ASSOCIAÇÃO NÃO CADASTRADA."},{status:400});
 await db.batch([
  db.update(colaboradores).set(values).where(eq(colaboradores.id,id)),
  db.update(planosTrabalho).set({associacao:associacoes[0],atualizadoEm:values.atualizadoEm}).where(eq(planosTrabalho.authUserId,atual.authUserId)),
  db.update(prestacoes).set({associacao:associacoes[0],atualizadoEm:values.atualizadoEm}).where(eq(prestacoes.authUserId,atual.authUserId))
 ]);
 return Response.json({message:"CADASTRO, PLANOS E PRESTAÇÕES VINCULADOS À ASSOCIAÇÃO INFORMADA. ATIVIDADES E ANEXOS PRESERVADOS."});
}
await db.update(colaboradores).set(values).where(eq(colaboradores.id,id));return Response.json({message:"CADASTRO ATUALIZADO COM SUCESSO."});}catch(error){return Response.json({message:error instanceof Error?error.message:"NÃO FOI POSSÍVEL ATUALIZAR."},{status:500})}}
export async function DELETE(request:Request){if(!await getAdminUser())return Response.json({message:"ACESSO NÃO AUTORIZADO."},{status:403});const id=Number(new URL(request.url).searchParams.get("id"));if(!Number.isInteger(id))return Response.json({message:"COLABORADOR INVÁLIDO."},{status:400});await getDb().delete(colaboradores).where(eq(colaboradores.id,id));return Response.json({message:"CADASTRO EXCLUÍDO. PLANOS E PRESTAÇÕES HISTÓRICOS FORAM PRESERVADOS."});}
