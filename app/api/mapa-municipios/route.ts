import {sql,eq} from "drizzle-orm";
import {getDb} from "@/db";
import {associacoes,colaboradores} from "@/db/schema";
import {consolidarMapa} from "@/lib/mapa-municipios";
export const runtime="edge";
export async function GET(){
 try{const db=getDb();const [grupos,pessoas,registros]=await Promise.all([
 db.select({nome:associacoes.nome,municipiosJson:associacoes.municipiosJson}).from(associacoes).where(eq(associacoes.ativo,true)),
 db.select({authUserId:colaboradores.authUserId,nomeCompleto:colaboradores.nomeCompleto,cargo:colaboradores.cargo,municipiosAtendidosJson:colaboradores.municipiosAtendidosJson,dataSaida:colaboradores.dataSaida}).from(colaboradores),
 db.all<{usuario:string;municipio:string;tipo:string;produtor:string;quantidade:number;tipoMuda:string;competencia:string;executada:number}>(sql`SELECT p.auth_user_id as usuario, COALESCE(json_extract(a.value,'$.municipio'),p.municipio) as municipio, COALESCE(json_extract(a.value,'$.tipoAtividade'),'Visita Técnica') as tipo, COALESCE(json_extract(a.value,'$.agricultor'),json_extract(a.value,'$.beneficiario'),'') as produtor, COALESCE(json_extract(a.value,'$.quantidadeMudas'),0) as quantidade, COALESCE(json_extract(a.value,'$.tipoMuda'),'') as tipoMuda, p.competencia, COALESCE(json_extract(a.value,'$.executada'),1) as executada FROM prestacoes p, json_each(p.atividades_json) a`),
 ]);
 // As entregas oficiais usam registros administrativos; evita somar novamente as referências dos técnicos.
 const oficiais=new Set(registros.filter(r=>r.usuario==="admin-importacao-mudas-2026").map(r=>`${r.municipio}|${r.competencia}`));
 const atividades=registros.filter(r=>!(/entrega de mudas/i.test(r.tipo)&&r.usuario!=="admin-importacao-mudas-2026"&&oficiais.has(`${r.municipio}|${r.competencia}`))).map(r=>({...r,executada:r.executada!==0,quantidade:typeof r.quantidade==="number"?r.quantidade:Number(String(r.quantidade).replace(/\./g,"").replace(",","."))||0}));
 return Response.json({municipios:consolidarMapa(grupos,pessoas,atividades),atualizadoEm:new Date().toISOString()},{headers:{"Cache-Control":"no-store, max-age=0"}});
 }catch(error){console.error('mapa_municipios',error);return Response.json({message:"Não foi possível consultar os indicadores agora."},{status:503});}
}
