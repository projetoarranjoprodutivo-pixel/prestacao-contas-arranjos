import {getAdminUser} from '@/lib/admin';
import {carregarAgenda} from '@/lib/agenda-entregas-store';
import {mesclarAgenda,ordenarAgenda,totalMudasAgenda} from '@/lib/agenda-entregas';
import {agendaDocx,agendaXlsx,linhasAgenda,notaAgenda} from '@/lib/agenda-exportar';
import {createPdf} from '@/lib/pdf';
export const runtime='edge';
export async function GET(request:Request){if(!await getAdminUser())return new Response('Acesso restrito.',{status:403});try{
 const p=new URL(request.url).searchParams;const formato=p.get('formato')||'pdf';if(!['pdf','docx','xlsx'].includes(formato))return new Response('Formato inválido.',{status:400});
 const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();const busca=norm(p.get('busca')||'');const excluidas=p.get('excluidas')==='1';const status=p.get('status')||'';const ordem=['municipio','previsao','culturas','status'].includes(p.get('ordem')||'')?p.get('ordem')!:'municipio';
 const itens=ordenarAgenda(mesclarAgenda(await carregarAgenda(),true).filter(i=>!!i.excluida===excluidas&&(!status||i.status===status)&&norm([i.municipio,i.culturas,i.previsao,i.quantidade].join(' ')).includes(busca)),ordem,p.get('direcao')==='desc');
 const filtro=`${itens.length} registros | Busca: ${p.get('busca')||'todas'} | Situação: ${status||'todas'} | Ordem: ${ordem} ${p.get('direcao')==='desc'?'decrescente':'crescente'}${excluidas?' | EXCLUÍDAS':''}`;
 const bytes=formato==='docx'?agendaDocx(itens,filtro):formato==='xlsx'?agendaXlsx(itens,filtro):await createPdf('AGENDA DE ENTREGAS · ARRANJOS PRODUTIVOS',[{heading:'PROGRAMAÇÃO',lines:[filtro,`TOTAL DE MUDAS: ${totalMudasAgenda(itens).toLocaleString("pt-BR")}`]},...linhasAgenda(itens).map(r=>({heading:r[0],lines:[`DATA(S): ${r[1]} | CULTURAS / ITENS: ${r[2]}`,`QUANTIDADE PREVISTA: ${r[3]} | SITUAÇÃO: ${r[4]}`,...(r[5]?r[5].match(/.{1,450}(?:\s|$)/g)||[r[5]]:[])]}))]);
 const tipo=formato==='pdf'?'application/pdf':formato==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
 return new Response(new Uint8Array(bytes),{headers:{'Content-Type':tipo,'Content-Disposition':`${formato==='pdf'?'inline':'attachment'}; filename="agenda-entregas.${formato}"`,'Cache-Control':'private, no-store'}});
 }catch(e){console.error('exportar_agenda',e);return new Response('Não foi possível exportar a agenda.',{status:500});}}
