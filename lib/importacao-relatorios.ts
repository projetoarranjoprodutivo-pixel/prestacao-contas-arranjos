import { z } from "zod";
const texto=z.string().max(12000).default("");
export const atividadeImportadaSchema=z.object({
 data:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),hora:texto,inicio:texto,duracao:z.string().max(20).default("").refine(v=>v===""||(Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=1440),"Duração inválida em minutos"),
 municipio:texto,comunidade:texto,propriedade:texto,agricultor:texto,telefone:texto,tipoAtividade:z.string().min(1).max(120),tipoMuda:texto,quantidadeMudas:texto,observacao:texto,resumo:z.string().min(1).max(12000),executada:z.boolean().default(true),assinaturaProdutor:texto,assinaturaTecnico:texto,
}).refine(a=>!Number.isNaN(Date.parse(a.data))&&new Date(a.data).toISOString().slice(0,10)===a.data,"Data inválida");
export type AtividadeImportada=z.infer<typeof atividadeImportadaSchema>;
export type ColaboradorImportacao={id:number;nomeCompleto:string;email:string;associacao:string|null;associacoesJson:string};
export const chaveTexto=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"");
export function identificarColaborador(nome:string,email:string,pessoas:ColaboradorImportacao[]){
 const exatoEmail=pessoas.filter(p=>email&&p.email.toLowerCase()===email.trim().toLowerCase());if(exatoEmail.length===1)return exatoEmail[0].id;
 const exatoNome=pessoas.filter(p=>nome&&chaveTexto(p.nomeCompleto)===chaveTexto(nome));return exatoNome.length===1?exatoNome[0].id:null;
}
export function listaJson<T>(valor:string|null|undefined):T[]{try{const dados:unknown=JSON.parse(valor||"[]");return Array.isArray(dados)?dados as T[]:[];}catch{return [];}}
export function unirAtividades<T extends {data?:string;hora?:string;inicio?:string;municipio?:string;agricultor?:string;tipoAtividade?:string;resumo?:string;observacao?:string}>(existentes:T[],novas:T[]){
 const chave=(a:T)=>[a.data,a.hora||a.inicio,a.municipio,a.agricultor,a.tipoAtividade,((a.hora||a.inicio)&&a.agricultor)?"":a.resumo||a.observacao].map(v=>chaveTexto(v||"")).join("|");
 const mapa=new Map(existentes.map(a=>[chave(a),a]));for(const a of novas)if(!mapa.has(chave(a)))mapa.set(chave(a),a);return [...mapa.values()];
}
export function totalMinutosImportados(atividades:Array<{duracao?:string;executada?:boolean}>){const feitas=atividades.filter(a=>a.executada!==false);const soma=feitas.reduce((t,a)=>t+(Number(a.duracao)||0),0);return soma|| (feitas.length?9600:0);}
export const confirmarImportacaoSchema=z.object({colaboradorId:z.number().int().positive(),competencia:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),associacao:z.string().min(1).max(200),descricao:z.string().max(60000),atividades:z.array(atividadeImportadaSchema).min(1).max(500),modo:z.enum(["complementar","substituir"]),versaoPrestacao:z.string().nullable(),versaoPlano:z.string().nullable()});

export function contarLinhasTabela(texto:string){
 const inicio=texto.search(/5\s*\.\s*1\s*\./),fim=texto.search(/5\s*\.\s*2\s*\./);
 if(inicio<0||fim<=inicio)return 0;
 const tabela=texto.slice(inicio,fim);
 return [...tabela.matchAll(/\b(?:0?[1-9]|[12]\d|3[01])\s*\/\s*(?:0?[1-9]|1[0-2])(?:\s*\/\s*(?:20)?\d{2})?\s+(?:[01]?\d|2[0-3]):[0-5]\d\b/g)].length;
}

export function tipoAtividadeImportada(tipo:string,resumo:string){
 const classificar=(texto:string)=>{
  if(/PREPAR|ORGANIZA|MOBILIZA/.test(texto))return "Mobilização";
  if(/ENTREGA/.test(texto)&&/MUDA|CAFE|CACAU/.test(texto))return "Entrega de Mudas";
  if(/VISITA|ORIENTACAOTECNICA/.test(texto))return "Visita Técnica";
  if(/DIAS?DECAMPO/.test(texto))return "Dia de Campo";
  if(/SEMINARIO/.test(texto))return "Seminário";
  if(/TREINAMENTO|CAPACITACAO/.test(texto))return "Treinamento";
  if(/REUNIAO|BATEPAPO/.test(texto))return "Reunião";
  if(/EVENTO|CONCURSO|POLODO/.test(texto))return "Evento";
  if(/INTERNA|INTERNO|ESTUDO|RELATORIO/.test(texto))return "Atividades internas";
  return "";
 };
 return classificar(chaveTexto(tipo))||classificar(chaveTexto(resumo))||"Atividades internas";
}

export function descricaoDetalhadaOriginal(texto:string){
 const inicio=texto.search(/5\s*\.\s*2\s*\.\s*DESCRI[CÇ][AÃ]O\s+DETALHADA/i);if(inicio<0)return "";
 const trecho=texto.slice(inicio),fim=trecho.search(/\b6\s*\.\s*ANEXOS|\b(?:5|6)\s*\.\s*[13]\s*\.\s*REGISTROS\s+FOTOGR/i);
 return (fim<0?trecho:trecho.slice(0,fim)).replace(/\[PÁGINA\s+\d+\]/gi,"").trim();
}
