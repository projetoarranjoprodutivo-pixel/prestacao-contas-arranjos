import {normalizarNomeAssociacao} from "./nome-associacao";
import {chaveMunicipio,mapaAssociacoesPorMunicipio} from "./associacoes-municipios";
import {ehEntregaMudas,quantidadeEntregue} from "./entregas-mudas";
import {numeroMonetario} from "./moeda";
import {numeroQuantidade} from "./quantidade";
import {categoriaDaNota} from "./classificacao-notas";
import {avaliarFomento,baseFomento,propriedadeIdentificada} from "./fomento-aderes";

export type GrupoTransparencia={id:number;nome:string;razaoSocial:string|null;cnpj:string|null;municipio:string|null;municipiosJson:string;documentosJson:string};
export type PessoaTransparencia={authUserId:string;nomeCompleto:string;cargo:string;associacao:string|null;associacoesJson:string;dataAdmissao:string;dataSaida:string|null};
export type RelatorioTransparencia={id:number;authUserId:string;competencia:string;associacao:string;totalMinutos:number;atualizadoEm:string};
export type AtividadeTransparencia={id:number;authUserId:string;competencia:string;associacao:string;totalMinutos:number;tipoAtividade:string;municipio:string;comunidade:string;data:string;agricultor:string;beneficiario:string;propriedade:string;resumo:string;duracao:string;quantidadeMudas:string;tipoMuda:string};
export type NotaTransparencia={associacao:string;competencia:string;key?:string;sha256?:string;categoriaNota?:string;nome?:string;descricao?:string;valor?:string;quantidade?:string};
export type DadosTransparencia={atualizadoEm:string;filtros:{ano:string;mes:string;associacao:string};opcoes:Array<{nome:string}>;resumo:{associacoes:number;municipios:number;relatorios:number;visitas:number;agricultores:number;propriedades:number;mudas:number;eventos:number;valorNotas:number;notas:number;notasSemValor:number};financeiro:Array<{associacao:string;competencia:string;categoria:string;notas:number;valor:number;semValor:number}>;territorios:Array<{associacao:string;municipio:string;visitas:number;agricultores:number;mudas:number;eventos:number}>;termos:Array<{associacao:string;razaoSocial:string;cnpj:string;municipios:string[];numero:string;inicio:string;termino:string;objetivo:string;metas:Array<{titulo:string;meta:string;situacao:string;resultado:string;atingida:boolean;fonte:string}>}>};
const lista=<T,>(texto:string):T[]=>{try{const a=JSON.parse(texto);return Array.isArray(a)?a:[];}catch{return [];}};
const valido=(s:string)=>!!s&&!/^(NAO INFORMAD[OA]|NAO IDENTIFICAD[OA]|DIVERSOS|SEM IDENTIFICACAO|SEM NOME|-)$/i.test(chaveMunicipio(s));

// Apenas o objeto explicitamente construído no retorno pode sair na API pública.
// Nomes de agricultores, IDs internos, documentos, chaves de arquivos e assinaturas ficam no servidor.
export function consolidarTransparencia(grupos:GrupoTransparencia[],pessoas:PessoaTransparencia[],relatorios:RelatorioTransparencia[],atividades:AtividadeTransparencia[],notas:NotaTransparencia[],filtros:DadosTransparencia["filtros"]):DadosTransparencia{
 const normal=normalizarNomeAssociacao;
 const opcoes=grupos.map(g=>({nome:normal(g.nome)})).sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR"));
 const selecionadas=grupos.filter(g=>!filtros.associacao||normal(g.nome)===normal(filtros.associacao));
 const nomes=new Set(selecionadas.map(g=>normal(g.nome)));
 const cobertura=mapaAssociacoesPorMunicipio(grupos);
 const municipiosConhecidos=new Set([...cobertura.keys(),"BARRA DE SAO FRANCISCO"]);
 const mesValido=(mes:string)=>mes.startsWith(filtros.ano+"-")&&(!filtros.mes||mes===`${filtros.ano}-${filtros.mes}`);
 const destino=(a:AtividadeTransparencia)=>a.authUserId==="admin-importacao-mudas-2026"?normal(cobertura.get(chaveMunicipio(a.municipio))):normal(a.associacao);
 const registros=atividades.filter(a=>mesValido(a.competencia)&&nomes.has(destino(a)));
 const recebidos=relatorios.filter(r=>mesValido(r.competencia)&&nomes.has(normal(r.associacao))&&r.authUserId!=="admin-importacao-mudas-2026");
 const produtores=new Set<string>(),propriedades=new Set<string>(),eventos=new Set<string>();
 const municipios=new Map<string,{associacao:string;municipio:string;visitas:number;produtores:Set<string>;mudas:number;eventos:Set<string>}>();
 let visitas=0,mudas=0;
 for(const a of registros){
  const assoc=destino(a),informado=chaveMunicipio(a.municipio).replace(/\s*(?:\/|-)\s*ES$/,"").trim(),m=municipiosConhecidos.has(informado)?informado:"",tipo=chaveMunicipio(a.tipoAtividade);
  const k=assoc+"|"+m,atual=municipios.get(k)||{associacao:assoc,municipio:m||"NÃO INFORMADO",visitas:0,produtores:new Set<string>(),mudas:0,eventos:new Set<string>()};
  if(tipo==="VISITA TECNICA"){
   visitas++;atual.visitas++;
   const nome=chaveMunicipio(a.agricultor||a.beneficiario);if(valido(nome)){produtores.add(nome);atual.produtores.add(nome);}
   const propriedade=chaveMunicipio(propriedadeIdentificada(a));if(valido(propriedade))propriedades.add(propriedade);
  }
  // A mesma entrega pode aparecer em vários relatórios técnicos; só o lançamento oficial entra no total.
  if(a.authUserId==="admin-importacao-mudas-2026"&&ehEntregaMudas(a)){const q=quantidadeEntregue(a);mudas+=q;atual.mudas+=q;}
  if(/^(DIAS? DE CAMPO|SEMINARIOS?|CAPACITACOES|CAPACITACAO|TREINAMENTOS?)$/.test(tipo)){
   const e=[a.competencia,a.data,m,chaveMunicipio(a.comunidade),tipo,chaveMunicipio(a.resumo)].join("|");eventos.add(e);atual.eventos.add(e);
  }
  municipios.set(k,atual);
 }
 const unicas=new Map<string,NotaTransparencia>();
 for(const n of notas){if(!mesValido(n.competencia)||!nomes.has(normal(n.associacao)))continue;const key=normal(n.associacao)+"|"+(n.sha256||n.key||JSON.stringify([n.competencia,n.nome,n.descricao,n.valor]));if(!unicas.has(key))unicas.set(key,n);}
 const financeiro=new Map<string,DadosTransparencia["financeiro"][number]>();let valorNotas=0,notasSemValor=0;
 for(const n of unicas.values()){
  const categoria=({servico:"SERVIÇOS",mudas:"COMPRA DE MUDAS",outras:"OUTRAS NOTAS"} as const)[categoriaDaNota(n)],associacao=normal(n.associacao),k=[associacao,n.competencia,categoria].join("|");
  const linha=financeiro.get(k)||{associacao,competencia:n.competencia,categoria,notas:0,valor:0,semValor:0};linha.notas++;
  const valor=numeroMonetario(n.valor);if(Number.isFinite(valor)){linha.valor+=valor;valorNotas+=valor;}else{linha.semValor++;notasSemValor++;}financeiro.set(k,linha);
 }
 const termos=selecionadas.map(g=>{
  const associacao=normal(g.nome),base=baseFomento(g.cnpj,g.documentosJson),atos=registros.filter(a=>destino(a)===associacao);
  const relat=recebidos.filter(r=>normal(r.associacao)===associacao);
  const profissionais=pessoas.filter(p=>[p.associacao,...lista<string>(p.associacoesJson)].some(a=>normal(a||"")===associacao));
  const meses=filtros.mes?[`${filtros.ano}-${filtros.mes}`]:Array.from({length:12},(_,i)=>`${filtros.ano}-${String(i+1).padStart(2,"0")}`);
  const compras=[...unicas.values()].filter(n=>normal(n.associacao)===associacao&&categoriaDaNota(n)==="mudas").reduce((s,n)=>s+Math.max(0,numeroQuantidade(n.quantidade)||0),0);
  const entregues=atos.filter(a=>a.authUserId==="admin-importacao-mudas-2026"&&ehEntregaMudas(a)).reduce((s,a)=>s+quantidadeEntregue(a),0);
  const mapaPessoas=new Map(profissionais.map(p=>[p.authUserId,p]));
  const metas=base?avaliarFomento(base,meses,atos.map(a=>({a,r:{id:a.id,authUserId:a.authUserId,competencia:a.competencia,totalMinutos:a.totalMinutos},u:mapaPessoas.get(a.authUserId)})),compras,entregues,null,{profissionais,relatorios:relat}):[];
  return {associacao,razaoSocial:g.razaoSocial||g.nome,cnpj:g.cnpj||"NÃO INFORMADO",municipios:[...new Set([...cobertura].filter(([,n])=>normal(n)===associacao).map(([m])=>m))],numero:base?.numero||"NÃO IDENTIFICADO",inicio:base?.inicio||"",termino:base?.termino||"",objetivo:base?.objetivoGeral||"",metas:metas.map(m=>({titulo:m.meta.titulo,meta:m.meta.meta,situacao:m.situacao,resultado:m.resultado.split("; ")[0],atingida:m.atingida,fonte:m.meta.fonte}))};
 }).sort((a,b)=>a.associacao.localeCompare(b.associacao,"pt-BR"));
 return {atualizadoEm:new Date().toISOString(),filtros,opcoes,resumo:{associacoes:selecionadas.length,municipios:new Set([...municipios.values()].filter(m=>m.municipio!=="NÃO INFORMADO"&&(m.visitas||m.mudas||m.eventos.size)).map(m=>m.municipio)).size,relatorios:recebidos.length,visitas,agricultores:produtores.size,propriedades:propriedades.size,mudas,eventos:eventos.size,valorNotas,notas:unicas.size,notasSemValor},financeiro:[...financeiro.values()].sort((a,b)=>a.associacao.localeCompare(b.associacao,"pt-BR")||a.competencia.localeCompare(b.competencia)||a.categoria.localeCompare(b.categoria)),territorios:[...municipios.values()].filter(m=>m.visitas||m.mudas||m.eventos.size).map(m=>({associacao:m.associacao,municipio:m.municipio,visitas:m.visitas,agricultores:m.produtores.size,mudas:m.mudas,eventos:m.eventos.size})).sort((a,b)=>a.associacao.localeCompare(b.associacao,"pt-BR")||a.municipio.localeCompare(b.municipio,"pt-BR")),termos};
}
