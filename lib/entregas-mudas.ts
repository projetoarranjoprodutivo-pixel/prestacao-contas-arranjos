import { TIPOS_MUDAS } from "@/lib/opcoes-atividades";

export type AtividadeMudas={tipoAtividade?:unknown;tipoMuda?:unknown;quantidadeMudas?:unknown;resumo?:unknown;observacao?:unknown};

function normalizar(valor:unknown){return String(valor??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");}

function numero(valor:unknown){
  if(typeof valor==="number")return Number.isFinite(valor)?valor:0;
  const encontrado=String(valor??"").match(/\d[\d.,\s]*/)?.[0].replace(/\s/g,"")||"";if(!encontrado)return 0;
  if(encontrado.includes(".")&&encontrado.includes(","))return Number(encontrado.replace(/\./g,"").replace(",","."))||0;
  if(/^[0-9]{1,3}([.,][0-9]{3})+$/.test(encontrado))return Number(encontrado.replace(/[.,]/g,""))||0;
  return Number(encontrado.replace(",","."))||0;
}

export function ehEntregaMudas(atividade:AtividadeMudas){
  const tipo=normalizar(atividade.tipoAtividade);if(tipo.includes("entrega")&&tipo.includes("muda"))return true;
  const texto=normalizar(`${atividade.resumo??""} ${atividade.observacao??""}`);
  return texto.includes("muda")&&/(entreg|distribu|fornec|receb)/.test(texto);
}

export function quantidadeEntregue(atividade:AtividadeMudas){
  const informada=numero(atividade.quantidadeMudas);if(informada>0)return informada;
  const texto=normalizar(`${atividade.resumo??""} ${atividade.observacao??""}`);
  const padroes=[/(?:entreg\w*|distribu\w*|fornec\w*)[^0-9]{0,40}(\d[\d.,\s]*)\s*(?:muda|unidade)/,/(\d[\d.,\s]*)\s*(?:muda|unidade)[^.;]{0,50}(?:entreg|distribu|fornec|receb)/];
  for(const padrao of padroes){const valor=numero(texto.match(padrao)?.[1]);if(valor>0)return valor;}return 0;
}

export function tipoMudaEntregue(atividade:AtividadeMudas){
  const informado=String(atividade.tipoMuda??"").trim();if(informado)return informado;
  const texto=normalizar(`${atividade.tipoAtividade??""} ${atividade.resumo??""} ${atividade.observacao??""}`);
  return [...TIPOS_MUDAS].sort((a,b)=>b.length-a.length).find(tipo=>texto.includes(normalizar(tipo)))||"NÃO INFORMADO";
}
