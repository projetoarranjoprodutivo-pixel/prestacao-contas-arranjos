import {sql,eq} from "drizzle-orm";
import {getDb} from "@/db";
import {associacoes,colaboradores} from "@/db/schema";
import {normalizarNomeAssociacao} from "@/lib/nome-associacao";
import {consolidarTransparencia,type AtividadeTransparencia,type RelatorioTransparencia,type NotaTransparencia} from "@/lib/transparencia";
export const runtime="edge";
export async function GET(request:Request){
 const params=new URL(request.url).searchParams;
 const ano=params.get("ano")||new Intl.DateTimeFormat("en",{timeZone:"America/Sao_Paulo",year:"numeric"}).format(new Date());
 const mes=params.get("mes")||"",associacao=params.get("associacao")||"";
 if(!/^(20\d{2}|2100)$/.test(ano)||(mes&&!/^(0[1-9]|1[0-2])$/.test(mes))||associacao.length>120)return Response.json({message:"SELECIONE UM PERÍODO VÁLIDO."},{status:400});
 try{
  const db=getDb(),inicio=mes?`${ano}-${mes}`:`${ano}-01`,fim=mes?`${ano}-${mes}`:`${ano}-12`;
  const [grupos,pessoas,relatorios,atividades,notas]=await Promise.all([
   db.select({id:associacoes.id,nome:associacoes.nome,razaoSocial:associacoes.razaoSocial,cnpj:associacoes.cnpj,municipio:associacoes.municipio,municipiosJson:associacoes.municipiosJson,documentosJson:associacoes.documentosJson}).from(associacoes).where(eq(associacoes.ativo,true)),
   db.select({authUserId:colaboradores.authUserId,nomeCompleto:colaboradores.nomeCompleto,cargo:colaboradores.cargo,associacao:colaboradores.associacao,associacoesJson:colaboradores.associacoesJson,dataAdmissao:colaboradores.dataAdmissao,dataSaida:colaboradores.dataSaida}).from(colaboradores),
   db.all<RelatorioTransparencia>(sql`SELECT id,auth_user_id as authUserId,competencia,associacao,total_minutos as totalMinutos,atualizado_em as atualizadoEm FROM prestacoes WHERE competencia BETWEEN ${inicio} AND ${fim}`),
   // Projeção explícita: não carregar assinaturas, telefones, anexos nem JSON completos.
   db.all<AtividadeTransparencia>(sql`SELECT p.id,p.auth_user_id as authUserId,p.competencia,p.associacao,p.total_minutos as totalMinutos,
    COALESCE(json_extract(a.value,'$.tipoAtividade'),'Visita Técnica') as tipoAtividade,
    COALESCE(json_extract(a.value,'$.municipio'),'') as municipio,COALESCE(json_extract(a.value,'$.comunidade'),'') as comunidade,
    COALESCE(json_extract(a.value,'$.data'),'') as data,COALESCE(json_extract(a.value,'$.agricultor'),'') as agricultor,
    COALESCE(json_extract(a.value,'$.beneficiario'),'') as beneficiario,COALESCE(json_extract(a.value,'$.propriedade'),'') as propriedade,
    COALESCE(json_extract(a.value,'$.resumo'),'') as resumo,COALESCE(json_extract(a.value,'$.duracao'),'') as duracao,
    COALESCE(json_extract(a.value,'$.quantidadeMudas'),'') as quantidadeMudas,COALESCE(json_extract(a.value,'$.tipoMuda'),'') as tipoMuda
    FROM prestacoes p,json_each(p.atividades_json) a WHERE p.competencia BETWEEN ${inicio} AND ${fim} AND COALESCE(json_extract(a.value,'$.executada'),1)!=0`),
   db.all<NotaTransparencia>(sql`SELECT d.associacao,
    CASE WHEN json_extract(n.value,'$.competencia') GLOB '[12][0-9][0-9][0-9]-[01][0-9]' THEN json_extract(n.value,'$.competencia') ELSE d.competencia END as competencia,
    COALESCE(json_extract(n.value,'$.key'),'') as key,COALESCE(json_extract(n.value,'$.sha256'),'') as sha256,
    COALESCE(json_extract(n.value,'$.categoriaNota'),'') as categoriaNota,COALESCE(json_extract(n.value,'$.nome'),'') as nome,
    COALESCE(json_extract(n.value,'$.descricao'),'') as descricao,COALESCE(json_extract(n.value,'$.valor'),'') as valor,
    COALESCE(json_extract(n.value,'$.quantidade'),'') as quantidade FROM documentos_associacao d,json_each(d.notas_fiscais_json) n
    WHERE (CASE WHEN json_extract(n.value,'$.competencia') GLOB '[12][0-9][0-9][0-9]-[01][0-9]' THEN json_extract(n.value,'$.competencia') ELSE d.competencia END) BETWEEN ${inicio} AND ${fim}`),
  ]);
  if(associacao&&!grupos.some(g=>normalizarNomeAssociacao(g.nome)===normalizarNomeAssociacao(associacao)))return Response.json({message:"ASSOCIAÇÃO NÃO ENCONTRADA."},{status:400});
  return Response.json(consolidarTransparencia(grupos,pessoas,relatorios,atividades,notas,{ano,mes,associacao}),{headers:{"Cache-Control":"no-store, max-age=0","X-Content-Type-Options":"nosniff"}});
 }catch(error){console.error("transparencia_consulta",error);return Response.json({message:"NÃO FOI POSSÍVEL ATUALIZAR OS DADOS. TENTE NOVAMENTE."},{status:503,headers:{"Cache-Control":"no-store"}});}
}
