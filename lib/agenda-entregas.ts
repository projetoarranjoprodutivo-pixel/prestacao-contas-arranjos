import iniciais from "@/data/agenda-entregas-inicial.json";
import {z} from "zod";
export const agendaSchema=z.object({municipio:z.string().trim().min(1).max(120),horario:z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/,'Horário inválido.').default(''),endereco:z.string().trim().max(300).default(''),previsao:z.string().trim().max(250),culturas:z.string().trim().max(250),quantidade:z.string().trim().max(200),status:z.enum(['sem-data','programada','confirmada','concluida','cancelada']),observacoes:z.string().trim().max(3000)});
export type AgendaEntrega=z.infer<typeof agendaSchema>&{id:string;origem:string;versao:string;excluida?:boolean};
export const agendaInicial=iniciais as AgendaEntrega[];
export function mesclarAgenda(alteracoes:AgendaEntrega[],incluirExcluidas=false){const mapa=new Map(agendaInicial.map(i=>[i.id,i]));for(const item of alteracoes)mapa.set(item.id,item);return [...mapa.values()].filter(i=>incluirExcluidas||!i.excluida).sort((a,b)=>a.municipio.localeCompare(b.municipio,'pt-BR'));}

export function chaveDataAgenda(previsao:string){
 const meses=['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
 const texto=previsao.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const datas:Array<{ano:number;mes:number;dia:number}>=[];
 for(const m of texto.matchAll(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/g))datas.push({dia:Number(m[1]),mes:Number(m[2]),ano:Number(m[3]||0)});
 for(const m of texto.matchAll(/(\d{1,2})\s+(?:de\s+)?([a-z]+)(?:\s+(?:de\s+)?(\d{4}))?/g)){const mes=meses.indexOf(m[2])+1;if(mes)datas.push({dia:Number(m[1]),mes,ano:Number(m[3]||0)});}
 const chaves=datas.filter(d=>d.dia>=1&&d.dia<=31&&d.mes>=1&&d.mes<=12).map(d=>d.ano*10000+d.mes*100+d.dia);
 return chaves.length?Math.min(...chaves):null;
}
export function ordenarAgenda(itens:AgendaEntrega[],campo:string,decrescente=false){
 const comparar=new Intl.Collator('pt-BR',{numeric:true,sensitivity:'base'}).compare;
 return [...itens].sort((a,b)=>{let ordem=0;if(campo==='previsao'){const x=chaveDataAgenda(a.previsao),y=chaveDataAgenda(b.previsao);if(x===null||y===null){if(x===null&&y!==null)return 1;if(y===null&&x!==null)return -1;}else ordem=x-y;}else ordem=comparar(String(a[campo as keyof AgendaEntrega]||''),String(b[campo as keyof AgendaEntrega]||''));return (decrescente?-ordem:ordem)||comparar(a.municipio,b.municipio);});
}
export function quantidadeAgenda(texto:string){
 if(/kit|caixa|\bcx\b/i.test(texto))return 0;
 return texto.split(/[\/;+]/).reduce((total,parte)=>{const s=parte.trim().toLowerCase().replace(/\s*(mudas?|unidades?)\s*/g,'').trim();const m=s.match(/^([\d.,]+)\s*(mil)?$/);if(!m)return total;let n:number;if(m[2]&&/^\d{1,3}\.\d{3}$/.test(m[1]))n=Number(m[1])*1000;else n=Number(m[1].replace(/\./g,'').replace(',','.'))*(m[2]?1000:1);return total+(Number.isFinite(n)?n:0);},0);
}
export function totalMudasAgenda(itens:AgendaEntrega[]){return itens.filter(i=>!i.excluida&&i.status!=='cancelada').reduce((s,i)=>s+quantidadeAgenda(i.quantidade),0);}
