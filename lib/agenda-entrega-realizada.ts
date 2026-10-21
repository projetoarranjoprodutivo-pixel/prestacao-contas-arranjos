import {env} from 'cloudflare:workers';
import {getDb} from '@/db';
import {colaboradores} from '@/db/schema';
import {eq} from 'drizzle-orm';
import {quantidadeAgenda,type AgendaEntrega} from './agenda-entregas';
import {mapaAssociacoesPorMunicipio,chaveMunicipio} from './associacoes-municipios';
export function atividadesDaAgenda(item:AgendaEntrega){
 if(item.status!=='concluida')return [];
 if(!item.authUserIdEntrega)throw new Error('Selecione o responsável pela entrega.');
 const data=item.dataEntrega||'';if(!/^\d{4}-\d{2}-\d{2}$/.test(data)||new Date(data+'T12:00:00Z').toISOString().slice(0,10)!==data)throw new Error('Informe a data em que a entrega foi realizada.');
 const culturas=item.culturas.split(/[/;,]/).map(s=>s.trim()).filter(Boolean),quantidades=item.quantidade.split(/[/;+]/).map(s=>s.trim()).filter(Boolean);
 if(!culturas.length||culturas.some(s=>/^a definir$/i.test(s)))throw new Error('Informe a cultura entregue.');
 if(culturas.length!==quantidades.length)throw new Error('Informe uma quantidade por cultura, na mesma ordem, separando por / .');
 return culturas.map((tipoMuda,i)=>{const quantidade=quantidadeAgenda(quantidades[i]);if(quantidade<=0||!Number.isInteger(quantidade))throw new Error('Informe uma quantidade inteira de mudas por cultura. Kits não são contados como mudas.');return {agendaEntregaId:item.id,executada:true,tipoAtividade:'Entrega de mudas',tipoMuda,quantidadeMudas:String(quantidade),data,municipio:item.municipio,inicio:item.horario||'00:00',duracao:'0',unidadeDuracao:'horas',comunidade:'',propriedade:'',agricultor:'',telefone:'',resumo:`ENTREGA DE ${quantidade.toLocaleString('pt-BR')} MUDAS DE ${tipoMuda.toUpperCase()}.${item.endereco?' LOCAL: '+item.endereco:''}`,observacao:item.observacoes||'',assinaturaProdutor:'',assinaturaTecnico:''};});
}
export async function sincronizarEntregaAgenda(item:AgendaEntrega,anterior?:AgendaEntrega){
 if(item.status!=='concluida'&&anterior?.status!=='concluida')return;
 if(!env.DB)throw new Error('Banco de entregas indisponível.');
 const atividades=atividadesDaAgenda(item);let responsavel;
 if(atividades.length){responsavel=await getDb().query.colaboradores.findFirst({where:eq(colaboradores.authUserId,item.authUserIdEntrega!)});if(!responsavel?.associacao)throw new Error('Selecione um responsável com associação cadastrada.');}
 // A remoção do vínculo anterior e a gravação são uma única transação D1.
 // O ID da agenda torna a operação idempotente e preserva as demais atividades.
 const remover=env.DB.prepare(`UPDATE prestacoes SET atividades_json=COALESCE((SELECT json_group_array(json(value)) FROM json_each(prestacoes.atividades_json) WHERE COALESCE(json_extract(value,'$.agendaEntregaId'),'')<>?), '[]'), atualizado_em=? WHERE EXISTS(SELECT 1 FROM json_each(prestacoes.atividades_json) WHERE json_extract(value,'$.agendaEntregaId')=?)`).bind(item.id,new Date().toISOString(),item.id);
 const statements=[remover];
 if(atividades.length&&responsavel){const associacao=mapaAssociacoesPorMunicipio().get(chaveMunicipio(item.municipio))||responsavel.associacao!;statements.push(env.DB.prepare(`INSERT INTO prestacoes (auth_user_id,competencia,municipio,associacao,atividades_json,total_minutos,anexos_json,status,atualizado_em) VALUES (?,?,?,?,?,0,'[]','enviado',?) ON CONFLICT(auth_user_id,competencia) DO UPDATE SET atividades_json=(SELECT json_group_array(json(value)) FROM (SELECT value FROM json_each(prestacoes.atividades_json) UNION ALL SELECT value FROM json_each(excluded.atividades_json))), atualizado_em=excluded.atualizado_em`).bind(responsavel.authUserId,item.dataEntrega!.slice(0,7),item.municipio,associacao,JSON.stringify(atividades),new Date().toISOString()));}
 await env.DB.batch(statements);
}
