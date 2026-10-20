import {chaveMunicipio} from "@/lib/associacoes-municipios";
import agricultoresBase from "@/data/agricultores-iniciais.json";
import {ehEntregaMudas,quantidadeEntregue,tipoMudaEntregue} from "@/lib/entregas-mudas";
import {sql,eq} from "drizzle-orm";
import {getDb} from "@/db";
import {associacoes,colaboradores} from "@/db/schema";
import {consolidarMapa} from "@/lib/mapa-municipios";
export const runtime="edge";
export async function GET(){
 try{const db=getDb();const [grupos,pessoas,registros,cadastros,entregas]=await Promise.all([
 db.select({nome:associacoes.nome,municipiosJson:associacoes.municipiosJson}).from(associacoes).where(eq(associacoes.ativo,true)),
 db.select({authUserId:colaboradores.authUserId,nomeCompleto:colaboradores.nomeCompleto,cargo:colaboradores.cargo,municipiosAtendidosJson:colaboradores.municipiosAtendidosJson,dataSaida:colaboradores.dataSaida}).from(colaboradores),
 db.all<{municipio:string;atendimentos:number;produtores:number;eventos:number;competencia:string}>(sql`SELECT COALESCE(json_extract(a.value,'$.municipio'),'') as municipio,
 SUM(CASE WHEN lower(replace(COALESCE(json_extract(a.value,'$.tipoAtividade'),'Visita Técnica'),'É','é'))='visita técnica' THEN 1 ELSE 0 END) as atendimentos,
 COUNT(DISTINCT CASE WHEN lower(replace(COALESCE(json_extract(a.value,'$.tipoAtividade'),'Visita Técnica'),'É','é'))='visita técnica' THEN NULLIF(upper(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(trim(COALESCE(json_extract(a.value,'$.agricultor'),json_extract(a.value,'$.beneficiario'),'')),'á','A'),'à','A'),'â','A'),'ã','A'),'Á','A'),'À','A'),'Â','A'),'Ã','A'),'é','E'),'ê','E'),'É','E'),'Ê','E'),'í','I'),'Í','I'),'ó','O'),'ô','O'),'õ','O'),'Ó','O'),'Ô','O'),'Õ','O'),'ú','U'),'ü','U'),'Ú','U'),'Ü','U'),'ç','C'),'Ç','C')), '') END) as produtores,
 SUM(CASE WHEN lower(replace(COALESCE(json_extract(a.value,'$.tipoAtividade'),'Visita Técnica'),'É','é')) NOT IN ('visita técnica','entrega de mudas') THEN 1 ELSE 0 END) as eventos, MAX(p.competencia) as competencia
 FROM prestacoes p, json_each(p.atividades_json) a WHERE COALESCE(json_extract(a.value,'$.executada'),1)!=0 GROUP BY municipio`),
 db.all<{nome:string;municipio:string}>(sql`SELECT COALESCE(json_extract(a.value,'$.agricultor'),'') as nome, COALESCE(json_extract(a.value,'$.municipio'),'') as municipio FROM colaboradores c, json_each(c.atendimentos_json) a`),
 db.all<{municipio:string;tipo:string;quantidade:number;tipoMuda:string;resumo:string;competencia:string;executada:number}>(sql`SELECT COALESCE(json_extract(a.value,'$.municipio'),'') as municipio, json_extract(a.value,'$.tipoAtividade') as tipo, json_extract(a.value,'$.quantidadeMudas') as quantidade, json_extract(a.value,'$.tipoMuda') as tipoMuda, json_extract(a.value,'$.resumo') as resumo, p.competencia, COALESCE(json_extract(a.value,'$.executada'),1) as executada FROM prestacoes p, json_each(p.atividades_json) a WHERE p.auth_user_id='admin-importacao-mudas-2026'`),
 ]);
 // Mesma origem e leitura do consolidado administrativo, em todas as competências.
 const atividades=entregas.map(r=>{const atividade={tipoAtividade:r.tipo,tipoMuda:r.tipoMuda,quantidadeMudas:r.quantidade,resumo:r.resumo};return {...r,usuario:"admin-importacao-mudas-2026",produtor:"",tipo:"Entrega de mudas",executada:r.executada!==0&&ehEntregaMudas(atividade),quantidade:quantidadeEntregue(atividade),tipoMuda:tipoMudaEntregue(atividade)};});
 const municipios=consolidarMapa(grupos,pessoas,atividades,[...agricultoresBase.map(c=>({nome:c.n,municipio:c.m})),...cadastros]);
 for(const r of registros){const m=municipios.find(m=>chaveMunicipio(m.nome)===chaveMunicipio(r.municipio));if(m){m.atendimentos+=Number(r.atendimentos)||0;m.produtores+=Number(r.produtores)||0;m.eventos+=Number(r.eventos)||0;if(r.competencia>m.ultimaCompetencia)m.ultimaCompetencia=r.competencia;}}
 return Response.json({municipios,atualizadoEm:new Date().toISOString()},{headers:{"Cache-Control":"no-store, max-age=0"}});
 }catch(error){console.error('mapa_municipios',error);return Response.json({message:"Não foi possível consultar os indicadores agora."},{status:503});}
}
