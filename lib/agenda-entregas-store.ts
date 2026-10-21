import {env} from "cloudflare:workers";
import type {AgendaEntrega} from "./agenda-entregas";
const prefix="agenda-entregas/v1/";
export async function carregarAgenda(){if(!env.BUCKET)throw new Error('Armazenamento indisponível.');let cursor:string|undefined;const itens:AgendaEntrega[]=[];do{const pagina=await env.BUCKET.list({prefix,cursor,limit:1000});const dados=await Promise.all(pagina.keys.map(k=>env.BUCKET!.get(k.name,'text')));for(const d of dados)if(d)itens.push(JSON.parse(d));cursor=pagina.list_complete?undefined:pagina.cursor;}while(cursor);return itens;}
