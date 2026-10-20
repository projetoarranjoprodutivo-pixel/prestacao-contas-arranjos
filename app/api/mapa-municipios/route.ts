import {ehEntregaMudas,quantidadeEntregue,tipoMudaEntregue} from "@/lib/entregas-mudas";
import {sql,eq} from "drizzle-orm";
import {getDb} from "@/db";
import {associacoes,colaboradores} from "@/db/schema";
import {consolidarMapa} from "@/lib/mapa-municipios";
export const runtime="edge";
export async function GET(){
 try{const db=getDb();const [grupos,pessoas,registros]=await Promise.all([
 db.select({nome:associacoes.nome,municipiosJson:associacoes.municipiosJson}).from(associacoes).where(eq(associacoes.ativo,true)),
 db.select({authUserId:colaboradores.authUserId,nomeCompleto:colaboradores.nomeCompleto,cargo:colaboradores.cargo,municipiosAtendidosJson:colaboradores.municipiosAtendidosJson,dataSaida:colaboradores.dataSaida}).from(colaboradores),
 db.all<{usuario:string;municipio:string;tipo:string;produtor:string;quantidade:number;tipoMuda:string;resumo:string;competencia:string;executada:number}>(sql`SELECT p.auth_user_id as usuario, COALESCE(json_extract(a.value,'$.municipio'),'') as municipio, COALESCE(json_extract(a.value,'$.tipoAtividade'),'Visita Técnica') as tipo, COALESCE(json_extract(a.value,'$.agricultor'),json_extract(a.value,'$.beneficiario'),'') as produtor, COALESCE(json_extract(a.value,'$.quantidadeMudas'),0) as quantidade, COALESCE(json_extract(a.value,'$.tipoMuda'),'') as tipoMuda, COALESCE(json_extract(a.value,'$.resumo'),'') as resumo, p.competencia, COALESCE(json_extract(a.value,'$.executada'),1) as executada FROM prestacoes p, json_each(p.atividades_json) a`),
 ]);
 // Mesma origem e leitura do consolidado administrativo, em todas as competências.
 const atividades=registros.map(r=>{
  const atividade={tipoAtividade:r.tipo,tipoMuda:r.tipoMuda,quantidadeMudas:r.quantidade,resumo:r.resumo};
  const entrega=ehEntregaMudas(atividade);
  return {...r,tipo:entrega?"Entrega de mudas":r.tipo,executada:r.executada!==0,
    quantidade:entrega&&r.usuario==="admin-importacao-mudas-2026"?quantidadeEntregue(atividade):0,
    tipoMuda:entrega?tipoMudaEntregue(atividade):r.tipoMuda};
 });
 return Response.json({municipios:consolidarMapa(grupos,pessoas,atividades),atualizadoEm:new Date().toISOString()},{headers:{"Cache-Control":"no-store, max-age=0"}});
 }catch(error){console.error('mapa_municipios',error);return Response.json({message:"Não foi possível consultar os indicadores agora."},{status:503});}
}
