import { chaveMunicipio } from "./associacoes-municipios";
import bases from "@/data/metas-fomento-2026.json";
export type MetaFomento={id:string;titulo:string;objetivo:string;meta:string;indicador:string;quantidade?:number;periodicidade:string;fonte:string};
export type BaseFomento={cnpj:string;associacao:string;numero:string;sha256:string;inicio:string;termino:string;objetivoGeral:string;alerta:string;metas:MetaFomento[]};
export type ParecerMeta={situacao:"automatico"|"realizada"|"parcial"|"nao-realizada";evidencia:string;justificativa:string};
export type ConferenciaFomento={sha256:string;competencias:string[];pareceres:Record<string,ParecerMeta>;atualizadoEm:string;responsavel:string};
export function baseFomento(cnpj:string|null,documentosJson:string){
 let docs:Array<{sha256?:string;categoria?:string}>=[];try{docs=JSON.parse(documentosJson);}catch{}
 const b=bases.find(b=>b.cnpj===(cnpj||"").replace(/\D/g,""));
 return b&&docs.filter(d=>d.categoria==="termo-fomento").at(-1)?.sha256===b.sha256?b as BaseFomento:null;
}
export const chaveConferencia=(id:number,hash:string,meses:string[])=>`associacoes/${id}/conferencia-fomento/${hash}/${[...new Set(meses)].sort().join('_')}.json`;
const normal=(s:unknown)=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().trim().replace(/\s+/g," ");
const qtd=(n:number)=>n.toLocaleString("pt-BR",{maximumFractionDigits:2});
type Atividade={executada?:boolean;tipoAtividade?:string;propriedade?:string;municipio?:string;comunidade?:string;agricultor?:string;beneficiario?:string;duracao?:string;resumo?:string};
export function propriedadeIdentificada(a:Pick<Atividade,"propriedade"|"agricultor"|"beneficiario">){
 const valido=(v:string|undefined)=>{const n=normal(v);return n&&!/^(NAO INFORMAD[OA]|DIVERSOS|NAO IDENTIFICAD[OA]|SEM IDENTIFICACAO|SEM NOME|-)$/.test(n)?String(v).trim():"";};
 return valido(a.propriedade)||valido(a.agricultor)||valido(a.beneficiario);
}

type Registro={a:Atividade;r:{id?:number;authUserId:string;competencia:string;totalMinutos?:number};u?:{cargo:string;nomeCompleto:string}};
type Profissional={authUserId:string;nomeCompleto:string;cargo:string;dataAdmissao?:string|null;dataSaida?:string|null};
type RelatorioMeta={id?:number;authUserId:string;competencia:string;totalMinutos?:number};
const META_PROPRIEDADES_POR_MUNICIPIO=40;
const chaveMunicipioMeta=(valor:string|undefined)=>chaveMunicipio(valor).replace(/\s*(?:\/|-)\s*ES$/,"");

type ContextoMetas={municipiosMetaSelecao?:string[];profissionais?:Profissional[];relatorios?:RelatorioMeta[];arquivosTecnicos?:Array<{nome:string;competencia:string}>};
export function avaliarFomento(base:BaseFomento,meses:string[],registros:Registro[],compradas:number,entregues:number,conferencia:ConferenciaFomento|null,contexto:ContextoMetas={}){
 const validos=registros.filter(x=>x.a.executada!==false);
 const visita=(x:Registro)=>normal(x.a.tipoAtividade)==='VISITA TECNICA';
 const visitas=validos.filter(visita);
 const propriedade=(x:Registro)=>normal(propriedadeIdentificada(x.a));
 const imoveis=new Set(visitas.map(propriedade).filter(Boolean));
 const pareceres=conferencia?.sha256===base.sha256&&[...conferencia.competencias].sort().join()===[...meses].sort().join()?conferencia.pareceres:{};
 const relatorios=contexto.relatorios||[...new Map(registros.map(x=>[x.r.authUserId+'|'+x.r.competencia,x.r])).values()];
 const pessoas=new Map((contexto.profissionais||[]).map(u=>[u.authUserId,u]));
 for(const x of registros)if(x.u&&!pessoas.has(x.r.authUserId))pessoas.set(x.r.authUserId,{authUserId:x.r.authUserId,...x.u});
 const tecnico=(cargo:string)=>/TECNIC[OA].*CAMPO/.test(normal(cargo));
 const consultor=(cargo:string)=>/CONSULTOR/.test(normal(cargo));
 const nome=(id:string)=>pessoas.get(id)?.nomeCompleto||id;
 const chave=(r:RelatorioMeta)=>r.competencia+' | '+r.authUserId;
 const rotulo=(k:string)=>{const [mes,id]=k.split(' | ');return mes+' | '+nome(id);};
 const gruposEsperados=(filtro:(cargo:string)=>boolean)=>{
  const grupos=new Map<string,boolean>();
  for(const u of contexto.profissionais||[])if(filtro(u.cargo))for(const mes of meses){
   if(mes<base.inicio||mes>base.termino||mes>new Date().toISOString().slice(0,7)||(u.dataAdmissao&&mes<u.dataAdmissao.slice(0,7))||(u.dataSaida&&mes>=u.dataSaida.slice(0,7)))continue;
   grupos.set(mes+' | '+u.authUserId,false);
  }
  for(const r of relatorios)if(filtro(pessoas.get(r.authUserId)?.cargo||''))grupos.set(chave(r),true);
  return grupos;
 };
 const comparar=(valor:number,meta:number)=>valor>=meta?'META QUANTITATIVA ATINGIDA':'META QUANTITATIVA AINDA NÃO ATINGIDA NOS REGISTROS DO PERÍODO';
 return base.metas.map(metaOriginal=>{
  const porMunicipio=metaOriginal.indicador==="selecao"&&contexto.municipiosMetaSelecao!==undefined;
  const municipios=new Map<string,{nome:string;propriedades:Set<string>}>();
  if(porMunicipio)for(const nome of contexto.municipiosMetaSelecao||[]){
   const chave=chaveMunicipioMeta(nome);
   if(chave&&!municipios.has(chave))municipios.set(chave,{nome,propriedades:new Set()});
  }
  const totalPactuado=municipios.size*META_PROPRIEDADES_POR_MUNICIPIO;
  const meta=porMunicipio?{
   ...metaOriginal,
   quantidade:totalPactuado||undefined,
   meta:`${META_PROPRIEDADES_POR_MUNICIPIO} propriedades rurais por município atendido no período de execução.`+
    (totalPactuado?` Total pactuado: ${qtd(totalPactuado)} propriedades em ${municipios.size} ${municipios.size===1?"município":"municípios"}.`:""),
  }:metaOriginal;
  let situacao='SEM REGISTROS LOCALIZADOS PARA AVALIAÇÃO';let resultado='';let situacaoQuantitativa='';let atingida=false;let evidenciaAutomatica='';
  const limite=meta.quantidade&&meta.quantidade>0?meta.quantidade:null;
  if(meta.indicador==='selecao'){
   if(porMunicipio){
    for(const x of visitas){
     const identificada=propriedade(x);
     if(identificada)municipios.get(chaveMunicipioMeta(x.a.municipio))?.propriedades.add(identificada);
    }
    const contagens=[...municipios.values()];
    const cumpridos=contagens.filter(m=>m.propriedades.size>=META_PROPRIEDADES_POR_MUNICIPIO).length;
    atingida=contagens.length>0&&cumpridos===contagens.length;
    situacaoQuantitativa=atingida?"META QUANTITATIVA ATINGIDA EM TODOS OS MUNICÍPIOS":
     contagens.length?`META QUANTITATIVA ATINGIDA EM ${cumpridos} DE ${contagens.length} MUNICÍPIOS`:
     "MUNICÍPIOS ATENDIDOS NÃO INFORMADOS NO CADASTRO";
    situacao=situacaoQuantitativa;
    resultado=contagens.length?
     contagens.map(m=>`${m.nome}: ${qtd(m.propriedades.size)}/${META_PROPRIEDADES_POR_MUNICIPIO} propriedades identificadas`).join("; ")+ ".":
     "O total pactuado depende da identificação dos municípios atendidos pela associação.";
   }else{
    if(limite){atingida=imoveis.size>=limite;situacaoQuantitativa=comparar(imoveis.size,limite);if(base.alerta)situacaoQuantitativa=atingida?'QUANTIDADE ATINGE A META DE REFERÊNCIA CADASTRADA · META DOCUMENTAL DIVERGENTE':'META DE REFERÊNCIA AINDA NÃO ATINGIDA · META DOCUMENTAL DIVERGENTE';situacao=situacaoQuantitativa;}
    else if(imoveis.size)situacao='PROPRIEDADES IDENTIFICADAS NOS REGISTROS';
    resultado=`${qtd(imoveis.size)} propriedades distintas identificadas nas visitas do período. ${qtd(visitas.filter(x=>!propriedade(x)).length)} visitas sem propriedade identificada.`;
    if(base.alerta)resultado+=' '+base.alerta;
   }
   if(visitas.length)evidenciaAutomatica=`${qtd(visitas.length)} visitas técnicas registradas nas prestações de ${meses.join('; ')}.`;
  }
  if(meta.indicador==='assistencia'){
   const alvo=limite||30;const grupos=new Map<string,Set<string>>();const informados=gruposEsperados(tecnico);
   for(const k of informados.keys())grupos.set(k,new Set());
   for(const x of visitas){const k=chave(x.r);const grupo=grupos.get(k)||new Set<string>();if(propriedade(x))grupo.add(propriedade(x));grupos.set(k,grupo);informados.set(k,true);}
   const cumpridos=[...grupos.values()].filter(v=>v.size>=alvo).length;const semRegistro=[...grupos.keys()].filter(k=>!informados.get(k)).length;
   atingida=grupos.size>0&&cumpridos===grupos.size;
   situacaoQuantitativa=atingida?'META MENSAL ATINGIDA EM TODOS OS TÉCNICOS E MESES ANALISADOS':cumpridos?`META MENSAL ATINGIDA EM ${cumpridos} DE ${grupos.size} COMBINAÇÕES TÉCNICO/MÊS`:grupos.size?'META MENSAL AINDA NÃO ATINGIDA NOS REGISTROS ANALISADOS':'SEM REGISTROS DE ASSISTÊNCIA TÉCNICA NO PERÍODO';situacao=situacaoQuantitativa;
   resultado=[`${qtd(visitas.length)} visitas técnicas registradas. ${cumpridos} de ${grupos.size} combinações técnico/mês atingiram ${qtd(alvo)} propriedades distintas.`,...Array.from(grupos,([k,v])=>`${rotulo(k)}: ${qtd(v.size)}/${qtd(alvo)} propriedades · ${!informados.get(k)?'SEM PRESTAÇÃO LOCALIZADA':v.size>=alvo?'META ATINGIDA':'QUANTIDADE REGISTRADA ABAIXO DA META'}`),...(semRegistro?[`${semRegistro} combinações técnico/mês sem prestação localizada.`]:[])].join('; ');
   if(visitas.length)evidenciaAutomatica=`Visitas individualizadas por agricultor e data nas prestações do período.`;
  }
  if(meta.indicador==='mudas'){
   resultado=`${qtd(compradas)} mudas adquiridas identificadas nas notas fiscais. ${qtd(entregues)} mudas entregues nos lançamentos oficiais.`;
   if(limite){atingida=compradas>=limite;situacaoQuantitativa=atingida?'META QUANTITATIVA DE AQUISIÇÃO ATINGIDA':'META QUANTITATIVA DE AQUISIÇÃO AINDA NÃO ATINGIDA NOS REGISTROS';situacao=situacaoQuantitativa;resultado+=` Meta de aquisição: ${qtd(limite)} mudas. A distribuição e a implantação seguem acompanhamento próprio.`;}
   else situacao=compradas>0||entregues>0?'AQUISIÇÕES OU ENTREGAS REGISTRADAS · EXECUÇÃO DO PPM EM ACOMPANHAMENTO':'SEM AQUISIÇÕES OU ENTREGAS LOCALIZADAS NO PERÍODO';
   if(compradas>0||entregues>0)evidenciaAutomatica=`Notas fiscais de aquisição e lançamentos oficiais de entrega de mudas do período.`;
  }
  if(meta.indicador==='capacitacao'){
   const eventos=validos.filter(x=>/^(DIAS? DE CAMPO|SEMINARIOS?|TREINAMENTOS?|CAPACITACOES|CAPACITACAO)$/.test(normal(x.a.tipoAtividade)));
   const unicos=new Set(eventos.map(x=>`${x.r.competencia}|${normal((x.a as {data?:string}).data)}|${normal(x.a.municipio)}|${normal(x.a.comunidade)}|${normal(x.a.tipoAtividade)}|${normal(x.a.resumo)}`));
   resultado=`${qtd(unicos.size)} registros distintos de capacitação, dia de campo, seminário ou treinamento executado no período.`;
   if(limite){atingida=unicos.size>=limite;situacaoQuantitativa=comparar(unicos.size,limite);situacao=situacaoQuantitativa;resultado+=` Meta mínima: ${qtd(limite)} evento(s).`;}
   else situacao=unicos.size?'CAPACITAÇÕES EXECUTADAS E REGISTRADAS':'SEM CAPACITAÇÕES LOCALIZADAS NO PERÍODO';
   if(unicos.size)evidenciaAutomatica=`Eventos executados registrados nas prestações, com os relatórios e registros fotográficos vinculados.`;
  }
  if(meta.indicador==='consultoria'){
   const alvo=limite||160;const grupos=new Map<string,number|null>();const informados=gruposEsperados(consultor);for(const k of informados.keys())grupos.set(k,null);
   for(const r of relatorios)if(consultor(pessoas.get(r.authUserId)?.cargo||'')){const total=Number(r.totalMinutos);grupos.set(chave(r),total>0?total/60:null);}
   for(const x of validos.filter(x=>consultor(x.u?.cargo||pessoas.get(x.r.authUserId)?.cargo||''))){const k=chave(x.r);if(Number(x.r.totalMinutos)>0){grupos.set(k,Number(x.r.totalMinutos)/60);continue;}if(!grupos.has(k))grupos.set(k,null);}
   for(const k of grupos.keys())if(grupos.get(k)===null&&informados.get(k)){const minutos=validos.filter(x=>chave(x.r)===k).reduce((n,x)=>n+Math.max(0,Number(String(x.a.duracao||'').replace(',','.'))||0),0);if(minutos>0)grupos.set(k,minutos/60);}
   const cumpridos=[...grupos.values()].filter(h=>h!==null&&h>=alvo).length;atingida=grupos.size>0&&cumpridos===grupos.size;
   situacaoQuantitativa=atingida?'META MENSAL DE HORAS ATINGIDA EM TODOS OS CONSULTORES E MESES ANALISADOS':cumpridos?`META MENSAL DE HORAS ATINGIDA EM ${cumpridos} DE ${grupos.size} COMBINAÇÕES CONSULTOR/MÊS`:grupos.size?'META MENSAL DE HORAS A CONFERIR NOS REGISTROS':'SEM PRESTAÇÕES DE CONSULTORIA LOCALIZADAS NO PERÍODO';situacao=situacaoQuantitativa;
   resultado=grupos.size?[`Meta: ${qtd(alvo)} horas por consultor/mês.`,...Array.from(grupos,([k,h])=>`${rotulo(k)}: ${h===null?'HORAS NÃO INFORMADAS':qtd(h)+'/'+qtd(alvo)+' horas registradas · '+(h>=alvo?'META ATINGIDA':'QUANTIDADE REGISTRADA ABAIXO DA META')}`)].join('; '):'Nenhuma prestação vinculada a consultor foi localizada no período selecionado.';
   if([...grupos.values()].some(h=>h!==null))evidenciaAutomatica='Totais de horas registrados nas prestações dos consultores, sem repetir o total por atividade.';
  }
  if(meta.indicador==='sistema'){
   const trimestrais=[...new Set((contexto.arquivosTecnicos||[]).filter(a=>/TRIMESTR/.test(normal(a.nome))).map(a=>a.nome))];
   const mesesInformados=new Set(relatorios.map(r=>r.competencia));
   resultado=`${mesesInformados.size} competências com prestações registradas no sistema. ${trimestrais.length} arquivo(s) identificado(s) como relatório trimestral nos anexos.`;
   situacao=trimestrais.length?'RELATÓRIO TRIMESTRAL ANEXADO · PERIODICIDADE A CONFERIR':mesesInformados.size?'MONITORAMENTO MENSAL REGISTRADO · PERIODICIDADE TRIMESTRAL A CONFERIR':'SEM REGISTROS DE MONITORAMENTO LOCALIZADOS';
   if(trimestrais.length)evidenciaAutomatica=trimestrais.join('; ');else if(mesesInformados.size)evidenciaAutomatica='Prestações mensais registradas: '+[...mesesInformados].sort().join('; ')+'.';
  }
  if(meta.indicador==='qualitativo'){
   const apoio=validos.filter(x=>/ASSOCIAC|AGROINDUSTR|REGULARIZ|DIAGNOSTIC|CREDITO|MERCADO/.test(normal(x.a.resumo)));
   const relacionados=meta.id==='apoio'?apoio:validos;
   resultado=meta.id==='apoio'?`${apoio.length} atividades de apoio institucional identificadas nas descrições das prestações.`:`${validos.length} atividades executadas registradas, com ${imoveis.size} propriedades distintas identificadas e ${qtd(entregues)} mudas entregues.`;
   situacao=relacionados.length?'EXECUÇÃO REGISTRADA · RESULTADOS QUALITATIVOS EM ACOMPANHAMENTO':'SEM REGISTROS ESPECÍFICOS LOCALIZADOS NO PERÍODO';
   if(relacionados.length)evidenciaAutomatica='Descrições das atividades executadas e relatórios técnicos do período.';
  }
  const p=pareceres[meta.id];if(p&&p.situacao!=='automatico'&&!situacaoQuantitativa)situacao=({'realizada':'REALIZADA - DECLARAÇÃO DO RESPONSÁVEL','parcial':'PARCIALMENTE REALIZADA - DECLARAÇÃO DO RESPONSÁVEL','nao-realizada':'NÃO REALIZADA - DECLARAÇÃO DO RESPONSÁVEL'} as const)[p.situacao];
  return {meta,situacao,situacaoQuantitativa,atingida,resultado,evidenciaAutomatica,evidencia:p?.evidencia?.trim()||'',justificativa:p?.justificativa?.trim()||'',declarado:!!p&&p.situacao!=='automatico'};
 });
}
