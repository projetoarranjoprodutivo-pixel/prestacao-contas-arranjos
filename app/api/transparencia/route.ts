import {sql,eq} from "drizzle-orm";
import {getAdminUser} from "@/lib/admin";
import {getDb} from "@/db";
import {associacoes,colaboradores} from "@/db/schema";
import {normalizarNomeAssociacao} from "@/lib/nome-associacao";
import {consolidarTransparencia,type AtividadeTransparencia,type RelatorioTransparencia,type NotaTransparencia} from "@/lib/transparencia";
export const runtime="edge";
export async function GET(request:Request){
 if(!await getAdminUser())return Response.json({message:"ACESSO ADMINISTRATIVO NECESSÁRIO."},{status:403,headers:{"Cache-Control":"private, no-store"}});
 const params=new URL(request.url).searchParams;
 const ano=params.get("ano")||new Intl.DateTimeFormat("en",{timeZone:"America/Sao_Paulo",year:"numeric"}).format(new Date());
 const mes=params.get("mes")||"",associacao=params.get("associacao")||"";
 if(!/^(20\d{2}|2100)$/.test(ano)||(mes&&!/^(0[1-9]|1[0-2])$/.test(mes))||associacao.length>120)return Response.json({message:"SELECIONE UM PERÍODO VÁLIDO."},{status:400});
 try{
  const db=getDb(),inicio=mes?`${ano}-${mes}`:`${ano}-01`,fim=mes?`${ano}-${mes}`:`${ano}-12`;
  const [grupos,pessoas,relatorios,atividades,notas]=await Promise.all([
   db.select({id:associacoes.id,nome:associacoes.nome,razaoSocial:associacoes.razaoSocial,cnpj:associacoes.cnpj,municipio:associacoes.municipio,municipiosJson:associacoes.municipiosJson,documentosJson:associacoes.documentosJson}).from(associacoes).where(eq(associacoes.ativo,true)),
   db.select({authUserId:colaboradores.authUserId,nomeCompleto:colaboradores.nomeCompleto,cargo:colaboradores.cargo,associacao:colaboradores.associacao,associacoesJson:colaboradores.associacoesJson,dataAdmissao:colaboradores.dataAdmissao,dataSaida:colaboradores.dataSaida}).from(colaboradores),
   db.all<RelatorioTransparencia>(sql`SELECT id,auth_user_id as authUserId,competencia,associacao,municipio,total_minutos as totalMinutos,atualizado_em as atualizadoEm FROM prestacoes WHERE competencia BETWEEN ${inicio} AND ${fim}`),
   // Projeção explícita: não carregar assinaturas, telefones, anexos nem JSON completos.
   db.all<AtividadeTransparencia>(sql`SELECT p.id,p.auth_user_id as authUserId,p.competencia,p.associacao,p.total_minutos as totalMinutos,
    COALESCE(json_extract(a.value,'$.tipoAtividade'),'') as tipoAtividade,
    COALESCE(NULLIF(TRIM(json_extract(a.value,'$.municipio')),''),p.municipio,'') as municipio,COALESCE(json_extract(a.value,'$.comunidade'),'') as comunidade,
    COALESCE(json_extract(a.value,'$.data'),'') as data,COALESCE(json_extract(a.value,'$.agricultor'),'') as agricultor,
    COALESCE(json_extract(a.value,'$.beneficiario'),'') as beneficiario,COALESCE(json_extract(a.value,'$.propriedade'),'') as propriedade,
    COALESCE(NULLIF(TRIM(json_extract(a.value,'$.resumo')),''),json_extract(a.value,'$.observacao'),'') as resumo,COALESCE(json_extract(a.value,'$.duracao'),'') as duracao,
    COALESCE(json_extract(a.value,'$.quantidadeMudas'),'') as quantidadeMudas,COALESCE(json_extract(a.value,'$.tipoMuda'),'') as tipoMuda
    FROM prestacoes p,json_each(CASE WHEN json_valid(p.atividades_json) THEN p.atividades_json ELSE '[]' END) a WHERE p.competencia BETWEEN ${inicio} AND ${fim} AND a.type='object' AND LOWER(TRIM(COALESCE(json_extract(a.value,'$.executada'),'1'))) NOT IN ('0','false','não','nao')`),
   db.all<NotaTransparencia>(sql`SELECT d.associacao,
    COALESCE(json_extract(n.value,'$.vinculoPrestacao.competencia'),NULLIF(json_extract(n.value,'$.competenciaDescricao'),''),CASE WHEN json_extract(n.value,'$.competencia') GLOB '[12][0-9][0-9][0-9]-[01][0-9]' THEN json_extract(n.value,'$.competencia') END,d.competencia) as competencia,
    COALESCE(json_extract(n.value,'$.key'),'') as key,COALESCE(json_extract(n.value,'$.sha256'),'') as sha256,
    COALESCE(json_extract(n.value,'$.categoriaNota'),'') as categoriaNota,COALESCE(json_extract(n.value,'$.nome'),'') as nome,
    COALESCE(json_extract(n.value,'$.descricao'),'') as descricao,COALESCE(json_extract(n.value,'$.valor'),'') as valor,
    COALESCE(json_extract(n.value,'$.quantidade'),'') as quantidade FROM documentos_associacao d,json_each(CASE WHEN json_valid(d.notas_fiscais_json) THEN d.notas_fiscais_json ELSE '[]' END) n
    WHERE n.type='object' AND (COALESCE(json_extract(n.value,'$.vinculoPrestacao.competencia'),NULLIF(json_extract(n.value,'$.competenciaDescricao'),''),CASE WHEN json_extract(n.value,'$.competencia') GLOB '[12][0-9][0-9][0-9]-[01][0-9]' THEN json_extract(n.value,'$.competencia') END,d.competencia)) BETWEEN ${inicio} AND ${fim}`),
  ]);
  if(associacao&&!grupos.some(g=>normalizarNomeAssociacao(g.nome)===normalizarNomeAssociacao(associacao)))return Response.json({message:"ASSOCIAÇÃO NÃO ENCONTRADA."},{status:400});
  return Response.json(consolidarTransparencia(grupos,pessoas,relatorios,atividades,notas,{ano,mes,associacao}),{headers:{"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff"}});
 }catch(error){console.error("transparencia_consulta",error);return Response.json({message:"NÃO FOI POSSÍVEL ATUALIZAR OS DADOS. TENTE NOVAMENTE."},{status:503,headers:{"Cache-Control":"no-store"}});}
}
