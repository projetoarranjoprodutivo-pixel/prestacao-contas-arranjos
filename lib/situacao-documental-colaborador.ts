import {ativoNaCompetencia} from "@/lib/vinculo-colaborador";
import {competenciaDaNota,notaPertenceAoColaborador} from "@/lib/notas-servico";
import {categoriaDaNota} from "@/lib/classificacao-notas";
type Pessoa=Parameters<typeof notaPertenceAoColaborador>[1];
type Documento={associacao:string;competencia:string;notasFiscaisJson:string};
type Prestacao={competencia:string;status:string};
type Nota=Parameters<typeof notaPertenceAoColaborador>[0];
export const chaveAssociacaoDocumental=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"").replace(/^APROVIPA$/,"APPROVIPA");
export function associacoesDocumentais(pessoa:Pessoa){let nomes:string[]=[];try{const xs=JSON.parse(pessoa.associacoesJson||"[]");if(Array.isArray(xs))nomes=xs.filter(x=>typeof x==="string"&&x.trim());}catch{}if(pessoa.associacao)nomes.push(pessoa.associacao);return [...new Map(nomes.map(n=>[chaveAssociacaoDocumental(n),n])).values()];}
export function montarSituacaoDocumental(pessoa:Pessoa,usuarios:Pessoa[],prestacoes:Prestacao[],documentos:Documento[],anoPedido?:string,agora=new Date()){
 const atual=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit"}).formatToParts(agora);
 const anoAtual=Number(atual.find(p=>p.type==="year")!.value),mesAtual=Number(atual.find(p=>p.type==="month")!.value);
 const ano=/^20\d{2}$/.test(anoPedido||"")&&Number(anoPedido)>=2026&&Number(anoPedido)<=anoAtual?Number(anoPedido):anoAtual;
 const competencias=Array.from({length:ano===anoAtual?mesAtual:12},(_,i)=>`${ano}-${String(i+1).padStart(2,"0")}`).filter(c=>c>="2026-03"&&ativoNaCompetencia(pessoa,c));
 const atualCompetencia=`${anoAtual}-${String(mesAtual).padStart(2,"0")}`;
 const recebidas=new Set(prestacoes.filter(p=>["enviado","importado","aprovado","concluido"].includes(p.status.toLowerCase())).map(p=>p.competencia));
 const notas=new Map<string,Nota[]>();for(const d of documentos){let xs:Nota[]=[];try{const v=JSON.parse(d.notasFiscaisJson);if(Array.isArray(v))xs=v.filter(n=>n&&typeof n==="object");}catch{}for(const n of xs){if(categoriaDaNota(n)!=="servico")continue;const k=chaveAssociacaoDocumental(d.associacao)+"|"+competenciaDaNota(n,d.competencia);notas.set(k,[...(notas.get(k)||[]),n]);}}
 const meses=(existe:(c:string)=>boolean)=>competencias.map(competencia=>({competencia,recebido:existe(competencia),atual:competencia===atualCompetencia}));
 return {ano,anos:Array.from({length:anoAtual-2026+1},(_,i)=>2026+i),prestacoes:meses(c=>recebidas.has(c)),notas:associacoesDocumentais(pessoa).map(associacao=>({associacao,meses:meses(c=>(notas.get(chaveAssociacaoDocumental(associacao)+"|"+c)||[]).some(n=>notaPertenceAoColaborador(n,pessoa,usuarios.filter(u=>associacoesDocumentais(u).some(a=>chaveAssociacaoDocumental(a)===chaveAssociacaoDocumental(associacao))))))}))};
}
