import { verificarComprasMudas, type NotaCompraMudas } from "./notas-compra-mudas";
import {normalizarNomeAssociacao} from "./nome-associacao";
import {chaveMunicipio,mapaAssociacoesPorMunicipio} from "./associacoes-municipios";
import {ehEntregaMudas,ehEntregaOficialDeMudas,quantidadeEntregue} from "./entregas-mudas";
import {numeroMonetario} from "./moeda";
import {numeroQuantidade} from "./quantidade";
import {categoriaDaNota} from "./classificacao-notas";
import {avaliarFomento,baseFomento,propriedadeIdentificada} from "./fomento-aderes";

export type GrupoTransparencia={id:number;nome:string;razaoSocial:string|null;cnpj:string|null;municipio:string|null;municipiosJson:string;documentosJson:string};
export type PessoaTransparencia={authUserId:string;nomeCompleto:string;cargo:string;associacao:string|null;associacoesJson:string;dataAdmissao:string;dataSaida:string|null};
export type RelatorioTransparencia={id:number;authUserId:string;competencia:string;associacao:string;municipio?:string;totalMinutos:number;atualizadoEm:string};
export type AtividadeTransparencia={agendaEntregaId?:string;id:number;authUserId:string;competencia:string;associacao:string;totalMinutos:number;tipoAtividade:string;municipio:string;comunidade:string;data:string;agricultor:string;beneficiario:string;propriedade:string;resumo:string;duracao:string;quantidadeMudas:string;tipoMuda:string};
export type NotaTransparencia=NotaCompraMudas & {associacao:string;competencia:string;key?:string;sha256?:string;referenciasNfeJson?:string;categoriaNota?:string;nome?:string;descricao?:string;valor?:string;quantidade?:string};
export type DadosTransparencia={atualizadoEm:string;filtros:{ano:string;mes:string;associacao:string};opcoes:Array<{nome:string}>;resumo:{associacoes:number;municipios:number;relatorios:number;visitas:number;agricultores:number;propriedades:number;mudas:number;eventos:number;valorNotas:number;notas:number;notasSemValor:number;remessasPendentes:number};execucao:LinhaExecucao[];financeiro:Array<{associacao:string;competencia:string;categoria:string;notas:number;valor:number;semValor:number}>;territorios:Array<{associacao:string;municipio:string;visitas:number;agricultores:number;mudas:number;eventos:number;produtoresIds:number[];eventosIds:number[]}>;termos:Array<{associacao:string;razaoSocial:string;cnpj:string;municipios:string[];numero:string;inicio:string;termino:string;objetivo:string;valorTermo:number|null;metas:Array<{titulo:string;meta:string;situacao:string;resultado:string;atingida:boolean;fonte:string}>}>};
type LinhaExecucao = {
 associacao:string;competencia:string;relatorios:number;relatoriosSemAtividades:number;
 visitas:number;diasDeCampo:number;seminarios:number;capacitacoes:number;entregas:number;outras:number;
};

const visita = /^(?:VISITAS?(?: TECNICAS?)?(?: (?:DE|EM) CAMPO)?|(?:ATENDIMENTO|ASSISTENCIA|ACOMPANHAMENTO|ORIENTACAO) TECNIC[AO](?: (?:DE|EM) CAMPO)?)$/;
const evento = /^(DIAS? DE CAMPO|SEMINARIOS?|CAPACITACOES|CAPACITACAO|TREINAMENTOS?)$/;

const indicioVisita=/\b(?:VISITAS?\s+TECNICAS?|(?:ATENDIMENTO|ASSISTENCIA|ACOMPANHAMENTO|ORIENTACAO)\s+TECNIC[AO]|VISITAS?\s+(?:(?:A|AS|AO|AOS|EM|NA|NAS|NO|NOS)\s+)?(?:PROPRIEDADES?|AGRICULTORES?|PRODUTOR(?:ES)?|CAMPO))\b/;

function tipoDaAtividade(a:AtividadeTransparencia,normalizarTexto:typeof chaveMunicipio,normalizarTipo:(tipo:string)=>string) {
 const tipo=normalizarTipo(a.tipoAtividade);
 if(visita.test(tipo))return "VISITA TECNICA";
 if(evento.test(tipo)||ehEntregaMudas(a)||/^(?:REUNIAO|REUNIOES|PLANEJAMENTO)\b/.test(tipo))return tipo;
 const resumo=normalizarTexto(a.resumo);
 if(indicioVisita.test(tipo)||(!/\b(?:PLANEJAMENTO|AGENDAMENTO|PROGRAMACAO)\s+(?:D[AEOS]+\s+)?VISITAS?\b/.test(resumo)&&indicioVisita.test(resumo))||
    (!tipo&&[a.agricultor,a.beneficiario,a.propriedade].some(valido)))return "VISITA TECNICA";
 return tipo;
}

const lista=<T,>(texto:string):T[]=>{try{const a=JSON.parse(texto);return Array.isArray(a)?a:[];}catch{return [];}};
const valido=(s:string)=>!!s&&!/^(NAO INFORMAD[OA]|NAO IDENTIFICAD[OA]|DIVERSOS|SEM IDENTIFICACAO|SEM NOME|-)$/i.test(chaveMunicipio(s));

// A API administrativa recebe os indicadores consolidados.
// Nomes de agricultores, IDs internos, documentos, chaves de arquivos e assinaturas ficam no servidor.
export function consolidarTransparencia(grupos:GrupoTransparencia[],pessoas:PessoaTransparencia[],relatorios:RelatorioTransparencia[],atividades:AtividadeTransparencia[],notas:NotaTransparencia[],filtros:DadosTransparencia["filtros"]):DadosTransparencia{
 const nomesNormalizados=new Map<string|null|undefined,string>();
 const normal=(nome?:string|null)=>{
  const existente=nomesNormalizados.get(nome);
  if(existente)return existente;
  const resultado=normalizarNomeAssociacao(nome);
  nomesNormalizados.set(nome,resultado);
  return resultado;
 };
 const opcoes=grupos.map(g=>({nome:normal(g.nome)})).sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR"));
 const selecionadas=grupos.filter(g=>!filtros.associacao||normal(g.nome)===normal(filtros.associacao));
 const nomes=new Set(selecionadas.map(g=>normal(g.nome)));
 const cadastradas=new Set(grupos.map(g=>normal(g.nome)));
 const cobertura=mapaAssociacoesPorMunicipio(grupos);
 const municipiosConhecidos=new Set([...cobertura.keys(),"BARRA DE SAO FRANCISCO"]);
 const mesValido=(mes:string)=>mes.startsWith(filtros.ano+"-")&&(!filtros.mes||mes===`${filtros.ano}-${filtros.mes}`);
 const municipiosNormalizados=new Map<string,string>();
 const municipioNormal=(nome:string)=>{
  const existente=municipiosNormalizados.get(nome);
  if(existente!==undefined)return existente;
  const resultado=chaveMunicipio(nome).replace(/\s*(?:\/|-)\s*ES$/,"").trim();
  municipiosNormalizados.set(nome,resultado);
  return resultado;
 };
 const vinculos=new Map(pessoas.map(p=>[p.authUserId,[...new Set(
  [p.associacao,...lista<string>(p.associacoesJson)].filter(Boolean).map(normal),
 )].filter(nome=>cadastradas.has(nome))]));
 const semAssociacao="SEM ASSOCIAÇÃO";
 function destino(a:{authUserId:string;associacao:string;municipio?:string;agendaEntregaId?:string}){
  const informada=normal(a.associacao),territorial=normal(cobertura.get(municipioNormal(a.municipio||"")));
  if(a.agendaEntregaId)return territorial||informada;
  if(a.authUserId==="admin-importacao-mudas-2026")return territorial;
  if(informada!==semAssociacao&&informada!=="NAO INFORMADO"&&informada!=="NÃO INFORMADO")return informada;
  const vinculadas=vinculos.get(a.authUserId)||[];
  return vinculadas.length===1?vinculadas[0]:vinculadas.includes(territorial)?territorial:semAssociacao;
 }
 const noFiltro=(associacao:string)=>!filtros.associacao||nomes.has(associacao);
 const atividadesPeriodo=atividades.filter(a=>mesValido(a.competencia));
 const atividadesPorAssociacao=new Map<string,AtividadeTransparencia[]>();
 const relatoriosPorAssociacao=new Map<string,RelatorioTransparencia[]>();
 function agrupar<T>(mapa:Map<string,T[]>,chave:string,item:T){
  const grupo=mapa.get(chave);
  if(grupo)grupo.push(item);
  else mapa.set(chave,[item]);
 }
 const recebidos=relatorios.filter(r=>mesValido(r.competencia)&&noFiltro(destino(r))&&r.authUserId!=="admin-importacao-mudas-2026");
 const execucao=new Map<string,LinhaExecucao>();
 function linhaExecucao(associacao:string,competencia:string){
  const chave=associacao+"|"+competencia;
  let linha=execucao.get(chave);
  if(!linha){
   linha={associacao,competencia,relatorios:0,relatoriosSemAtividades:0,visitas:0,diasDeCampo:0,seminarios:0,capacitacoes:0,entregas:0,outras:0};
   execucao.set(chave,linha);
  }
  return linha;
 }
 const relatoriosComAtividades=new Set<number>();
 const eventosPorAssociacao=new Set<string>();
 const produtores=new Set<string>(),propriedades=new Set<string>(),eventos=new Set<string>();
 const municipios=new Map<string,{associacao:string;municipio:string;visitas:number;produtores:Set<string>;mudas:number;eventos:Set<string>}>();
 let visitas=0,mudas=0;
 const cacheTexto=new Map<string,string>();
 const cacheTipo=new Map<string,string>();
 function normalizarComCache(cache:Map<string,string>,texto:string,transformar:(texto:string)=>string){
  const existente=cache.get(texto);
  if(existente!==undefined)return existente;
  const resultado=transformar(texto);
  cache.set(texto,resultado);
  return resultado;
 }
 const normalizarTexto=(texto:string)=>normalizarComCache(cacheTexto,texto,chaveMunicipio);
 const normalizarTipo=(texto:string)=>normalizarComCache(cacheTipo,texto,
  valor=>normalizarTexto(valor).replace(/[()]/g," ").replace(/\s+/g," ").trim());
 for(const a of atividadesPeriodo){
  const assoc=destino(a),informado=municipioNormal(a.municipio);
  const m=municipiosConhecidos.has(informado)?informado:"";
  const territorial=cobertura.get(m);
  const assocMunicipio=territorial?normal(territorial):assoc;
  const incluirMunicipio=noFiltro(assocMunicipio),incluirRelatorio=noFiltro(assoc);
  if(!incluirMunicipio&&!incluirRelatorio)continue;

  const tipo=tipoDaAtividade(a,normalizarTexto,normalizarTipo),visita=tipo==="VISITA TECNICA";
  const produtor=visita?[a.agricultor,a.beneficiario].map(chaveMunicipio).find(valido):undefined;
  const entrega=ehEntregaOficialDeMudas(a.authUserId,a);
  const quantidade=entrega?quantidadeEntregue(a):0;
  const e=evento.test(tipo)?[a.competencia,a.data,m,chaveMunicipio(a.comunidade),tipo,normalizarTexto(a.resumo)].join("|"):"";

  if(incluirMunicipio){
   const k=assocMunicipio+"|"+m;
   const atual=municipios.get(k)||{associacao:assocMunicipio,municipio:m||"NÃO INFORMADO",visitas:0,produtores:new Set<string>(),mudas:0,eventos:new Set<string>()};
   if(visita)atual.visitas++;
   if(produtor)atual.produtores.add(produtor);
   atual.mudas+=quantidade;
   if(e)atual.eventos.add(e);
   municipios.set(k,atual);
  }

  if(!incluirRelatorio)continue;
  agrupar(atividadesPorAssociacao,assoc,tipo===a.tipoAtividade?a:{...a,tipoAtividade:tipo});
  relatoriosComAtividades.add(a.id);
  const linha=linhaExecucao(assoc,a.competencia);
  if(visita){
   visitas++;linha.visitas++;
   if(produtor)produtores.add(produtor);
   const propriedade=chaveMunicipio(propriedadeIdentificada(a));if(valido(propriedade))propriedades.add(propriedade);
  }
  if(entrega){mudas+=quantidade;linha.entregas++;}
  if(e){
   eventos.add(e);
   const chave=assoc+"|"+e;
   if(!eventosPorAssociacao.has(chave)){
    eventosPorAssociacao.add(chave);
    if(tipo.includes("CAMPO"))linha.diasDeCampo++;
    else if(tipo.startsWith("SEMINARIO"))linha.seminarios++;
    else linha.capacitacoes++;
   }
  }else if(!visita&&!ehEntregaMudas(a))linha.outras++;
 }

 for(const r of recebidos){
  const assoc=destino(r);
  agrupar(relatoriosPorAssociacao,assoc,r);
  const linha=linhaExecucao(assoc,r.competencia);
  linha.relatorios++;
  if(!relatoriosComAtividades.has(r.id))linha.relatoriosSemAtividades++;
 }
 const unicas=new Map<string,NotaTransparencia>();
 const comprasHistoricas = notas.filter(n=>/^\d{4}-(0[1-9]|1[0-2])$/.test(n.competencia)&&nomes.has(normal(n.associacao))&&categoriaDaNota(n)==="mudas").map(n=>{
  let referenciasNfe: string[] = [];
  try { const refs = JSON.parse(n.referenciasNfeJson || "[]"); if(Array.isArray(refs)) referenciasNfe=refs.filter(ref=>typeof ref==="string"); } catch {}
  return { associacao:n.associacao,competencia:n.competencia,arquivo:{...n,referenciasNfe},nota:n };
 });
 const verificacao = verificarComprasMudas(comprasHistoricas);
 const situacoes = new Map(comprasHistoricas.map(linha=>[linha.nota,verificacao.get(linha)]));
 let remessasPendentes=0;
 for(const n of notas){
  if(!mesValido(n.competencia)||!nomes.has(normal(n.associacao)))continue;
  const situacao=situacoes.get(n);
  if(situacao==="conferir-remessa")remessasPendentes++;
  if(situacao&&situacao!=="contabilizada")continue;
  const key=normal(n.associacao)+"|"+(n.sha256||n.key||JSON.stringify([n.competencia,n.nome,n.descricao,n.valor]));
  if(!unicas.has(key))unicas.set(key,n);
 }
 const financeiro=new Map<string,DadosTransparencia["financeiro"][number]>();let valorNotas=0,notasSemValor=0;
 for(const n of unicas.values()){
  const categoria=({servico:"SERVIÇOS",mudas:"COMPRA DE MUDAS",outras:"OUTRAS NOTAS"} as const)[categoriaDaNota(n)],associacao=normal(n.associacao),k=[associacao,n.competencia,categoria].join("|");
  const linha=financeiro.get(k)||{associacao,competencia:n.competencia,categoria,notas:0,valor:0,semValor:0};linha.notas++;
  const valor=numeroMonetario(n.valor);if(Number.isFinite(valor)){linha.valor+=valor;valorNotas+=valor;}else{linha.semValor++;notasSemValor++;}financeiro.set(k,linha);
 }
 const comprasPorAssociacao=new Map<string,number>();
 for(const n of unicas.values()){
  if(categoriaDaNota(n)!=="mudas")continue;
  const nome=normal(n.associacao);
  comprasPorAssociacao.set(nome,(comprasPorAssociacao.get(nome)||0)+Math.max(0,numeroQuantidade(n.quantidade)||0));
 }
 const termos=selecionadas.map(g=>{
  const associacao=normal(g.nome),base=baseFomento(g.cnpj,g.documentosJson),atos=atividadesPorAssociacao.get(associacao)||[];
  const termo=lista<{categoria?:string;valorGlobal?:number}>(g.documentosJson).filter(d=>d.categoria==="termo-fomento").at(-1);
  const valorTermo=typeof termo?.valorGlobal==="number"&&Number.isFinite(termo.valorGlobal)&&termo.valorGlobal>0?termo.valorGlobal:null;
  const relat=relatoriosPorAssociacao.get(associacao)||[];
  const profissionais=pessoas.filter(p=>[p.associacao,...lista<string>(p.associacoesJson)].some(a=>normal(a||"")===associacao));
  const meses=filtros.mes?[`${filtros.ano}-${filtros.mes}`]:Array.from({length:12},(_,i)=>`${filtros.ano}-${String(i+1).padStart(2,"0")}`);
  const compras=comprasPorAssociacao.get(associacao)||0;
  const entregues=atos.filter(a=>ehEntregaOficialDeMudas(a.authUserId,a)).reduce((s,a)=>s+quantidadeEntregue(a),0);
  const mapaPessoas=new Map(profissionais.map(p=>[p.authUserId,p]));
  const mesesVigentes=base?meses.filter(m=>m>=base.inicio&&m<=base.termino):[];
  const metas=base&&mesesVigentes.length?avaliarFomento(base,mesesVigentes,atos.filter(a=>mesesVigentes.includes(a.competencia)).map(a=>({a,r:{id:a.id,authUserId:a.authUserId,competencia:a.competencia,totalMinutos:a.totalMinutos},u:mapaPessoas.get(a.authUserId)})),compras,entregues,null,{profissionais,relatorios:relat.filter(r=>mesesVigentes.includes(r.competencia))}):base?base.metas.map(meta=>({meta,situacao:"PERÍODO FORA DA VIGÊNCIA DO TERMO",resultado:"A META NÃO É AVALIADA FORA DA VIGÊNCIA DO INSTRUMENTO.",atingida:false})):[];
  return {associacao,razaoSocial:g.razaoSocial||g.nome,cnpj:g.cnpj||"NÃO INFORMADO",municipios:[...new Set([...cobertura].filter(([,n])=>normal(n)===associacao).map(([m])=>m))],numero:base?.numero||"NÃO IDENTIFICADO",inicio:base?.inicio||"",termino:base?.termino||"",objetivo:base?.objetivoGeral||"",valorTermo,metas:metas.map(m=>({titulo:m.meta.titulo,meta:m.meta.meta,situacao:m.situacao,resultado:m.resultado.split("; ")[0],atingida:m.atingida,fonte:m.meta.fonte}))};
 }).sort((a,b)=>a.associacao.localeCompare(b.associacao,"pt-BR"));
 const produtoresIds=new Map([...new Set([...municipios.values()].flatMap(m=>[...m.produtores]))].map((nome,i)=>[nome,i]));
 const eventosIds=new Map([...new Set([...municipios.values()].flatMap(m=>[...m.eventos]))].map((evento,i)=>[evento,i]));
 return {atualizadoEm:new Date().toISOString(),filtros,opcoes,resumo:{associacoes:selecionadas.length,municipios:new Set([...municipios.values()].filter(m=>m.municipio!=="NÃO INFORMADO"&&(m.visitas||m.mudas||m.eventos.size)).map(m=>m.municipio)).size,relatorios:recebidos.length,visitas,agricultores:produtores.size,propriedades:propriedades.size,mudas,eventos:eventos.size,valorNotas,notas:unicas.size,notasSemValor,remessasPendentes},execucao:[...execucao.values()].sort((a,b)=>a.competencia.localeCompare(b.competencia)||a.associacao.localeCompare(b.associacao,"pt-BR")),financeiro:[...financeiro.values()].sort((a,b)=>a.associacao.localeCompare(b.associacao,"pt-BR")||a.competencia.localeCompare(b.competencia)||a.categoria.localeCompare(b.categoria)),territorios:[...municipios.values()].filter(m=>m.visitas||m.mudas||m.eventos.size).map(m=>({associacao:m.associacao,municipio:m.municipio,visitas:m.visitas,agricultores:m.produtores.size,mudas:m.mudas,eventos:m.eventos.size,produtoresIds:[...m.produtores].map(nome=>produtoresIds.get(nome)!),eventosIds:[...m.eventos].map(evento=>eventosIds.get(evento)!)})).sort((a,b)=>a.associacao.localeCompare(b.associacao,"pt-BR")||a.municipio.localeCompare(b.municipio,"pt-BR")),termos};
}
