const competenciaValida=(valor:string)=>/^20\d{2}-(0[1-9]|1[0-2])$/.test(valor);
export function competenciasDoExtrato(inicio:string,fim:string){
 if(!competenciaValida(inicio)||!competenciaValida(fim))throw new Error("INFORME COMPETÊNCIA DE E COMPETÊNCIA ATÉ PARA CADA EXTRATO.");
 if(inicio>fim)throw new Error("A COMPETÊNCIA ATÉ NÃO PODE SER ANTERIOR À COMPETÊNCIA DE.");
 const primeiro=Number(inicio.slice(0,4))*12+Number(inicio.slice(5))-1,ultimo=Number(fim.slice(0,4))*12+Number(fim.slice(5))-1;
 if(ultimo-primeiro>=120)throw new Error("O INTERVALO DO EXTRATO DEVE TER NO MÁXIMO 120 COMPETÊNCIAS.");
 return Array.from({length:ultimo-primeiro+1},(_,i)=>{const n=primeiro+i;return `${Math.floor(n/12)}-${String(n%12+1).padStart(2,"0")}`;});
}
// Só usa períodos explicitamente escritos no conteúdo, nunca o nome do arquivo
// nem a primeira/última movimentação, que podem omitir meses sem lançamentos.
export function periodoDoExtrato(conteudo:string){
 const texto=conteudo.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\s+/g," ");
 const data="(\\d{1,2})[/.\\-](\\d{1,2})[/.\\-](20\\d{2})";
 const mes="(0?[1-9]|1[0-2])[/\\-](20\\d{2})";
 const trechos=[...texto.matchAll(/PERIODO|ABRANGENCIA|INTERVALO/g)].map(m=>texto.slice(m.index!,m.index!+180));
 trechos.push(...[...texto.matchAll(new RegExp(`\\bDE\\s+${data}\\s+(?:A|ATE|-)\\s+${data}`,"g"))].map(m=>m[0]));
 for(const trecho of trechos){
  const par=trecho.match(new RegExp(`\\b${data}\\s*(?:A|ATE|–|—|-)\\s*${data}\\b`));
  if(par){const validas=[1,4].map(i=>{const dia=Number(par[i]),mes=Number(par[i+1]),ano=Number(par[i+2]);const dt=new Date(Date.UTC(ano,mes-1,dia));return dt.getUTCFullYear()===ano&&dt.getUTCMonth()===mes-1&&dt.getUTCDate()===dia?`${ano}-${String(mes).padStart(2,"0")}-${String(dia).padStart(2,"0")}`:"";});if(validas.every(Boolean)&&validas[0]<=validas[1])return {competenciaInicio:validas[0].slice(0,7),competenciaFim:validas[1].slice(0,7)};}
  const mensal=trecho.match(new RegExp(`(?<![\\d/])${mes}\\s*(?:A|ATE|–|—|-)\\s*${mes}\\b`));
  if(!par&&mensal){const inicio=`${mensal[2]}-${mensal[1].padStart(2,"0")}`,fim=`${mensal[4]}-${mensal[3].padStart(2,"0")}`;if(inicio<=fim)return {competenciaInicio:inicio,competenciaFim:fim};}
 }
 return {competenciaInicio:"",competenciaFim:""};
}
