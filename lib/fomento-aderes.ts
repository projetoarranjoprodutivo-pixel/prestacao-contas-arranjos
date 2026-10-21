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
type Atividade={executada?:boolean;tipoAtividade?:string;propriedade?:string;municipio?:string;comunidade?:string;agricultor?:string;duracao?:string;resumo?:string};
type Registro={a:Atividade;r:{authUserId:string;competencia:string};u?:{cargo:string;nomeCompleto:string}};
export function avaliarFomento(base:BaseFomento,meses:string[],registros:Registro[],compradas:number,entregues:number,conferencia:ConferenciaFomento|null){
 const validos=registros.filter(x=>x.a.executada!==false);const visitas=validos.filter(x=>normal(x.a.tipoAtividade)==='VISITA TECNICA');
 const propriedade=(x:Registro)=>{const p=normal(x.a.propriedade);return !p||/^(NAO INFORMAD[OA]|DIVERSOS|NAO IDENTIFICAD[OA])$/.test(p)?'':`${normal(x.a.municipio)}|${normal(x.a.comunidade)}|${p}`;};
 const imoveis=new Set(visitas.map(propriedade).filter(Boolean));
 const pareceres=conferencia?.sha256===base.sha256&&[...conferencia.competencias].sort().join() === [...meses].sort().join()?conferencia.pareceres:{};
 return base.metas.map(meta=>{
  let situacao='SEM COMPROVAÇÃO SUFICIENTE';let resultado='';
  if(meta.indicador==='selecao')resultado=`${qtd(imoveis.size)} propriedades distintas identificadas nas visitas do período (município + comunidade + nome da propriedade). ${qtd(visitas.filter(x=>!propriedade(x)).length)} visitas sem propriedade identificada. Visitas e agricultores não substituem o diagnóstico de seleção. ${base.alerta?'Meta quantitativa divergente no documento; confirmar antes de atestar.':''}`;
  if(meta.indicador==='assistencia'){
   const grupos=new Map<string,Set<string>>();for(const x of visitas){const k=x.r.competencia+' | '+(x.u?.nomeCompleto||x.r.authUserId);const set=grupos.get(k)||new Set<string>();if(propriedade(x))set.add(propriedade(x));grupos.set(k,set);}
   resultado=[`${qtd(visitas.length)} visitas registradas; a meta é de propriedades distintas por técnico/mês, não de visitas.`,...Array.from(grupos,([k,v])=>`${k}: ${qtd(v.size)}/30 propriedades identificadas; ${v.size>=30?"quantidade mínima registrada":"abaixo da meta mensal; faltam "+qtd(30-v.size)+" propriedades identificadas"}`),'Técnicos sem relatório e propriedades sem identificação exigem conferência; não se presume cumprimento pela soma geral.'].join('; ');
  }
  if(meta.indicador==='mudas')resultado=`Mudas adquiridas identificadas nas notas do período: ${qtd(compradas)}. Mudas entregues nos lançamentos oficiais do período: ${qtd(entregues)}. Compra, entrega e implantação são etapas distintas. É necessária a conferência das especificações, beneficiários, PPM, prazos e acompanhamento do plantio; quantidade isolada não comprova o objetivo integral.`;
  if(meta.indicador==='capacitacao'){
   const eventos=validos.filter(x=>/^(DIA(S)? DE CAMPO|SEMINARIO|TREINAMENTO|CAPACITACAO)$/.test(normal(x.a.tipoAtividade)));
   const unicos=new Set(eventos.map(x=>`${x.r.competencia}|${normal((x.a as {data?:string}).data)}|${normal(x.a.municipio)}|${normal(x.a.tipoAtividade)}|${normal(x.a.resumo)}`));
   resultado=`${qtd(unicos.size)} registros distintos de capacitação, dia de campo, seminário ou treinamento executado no período. Validar datas, listas de presença e relatório do evento; registros de organização ou mobilização não são tratados como evento realizado.`;
   if(unicos.size)situacao='EXECUÇÃO REGISTRADA - VALIDAR EVIDÊNCIAS';
  }
  if(meta.indicador==='consultoria'){
   const grupos=new Map<string,number>();let semDuracao=0;for(const x of validos.filter(x=>/CONSULTOR/.test(normal(x.u?.cargo)))){const d=Number(String(x.a.duracao||'').replace(',','.'));if(!(d>0)){semDuracao++;continue;}const k=x.r.competencia+' | '+(x.u?.nomeCompleto||x.r.authUserId);grupos.set(k,(grupos.get(k)||0)+d/60);}
   resultado=[...Array.from(grupos,([k,v])=>`${k}: ${qtd(v)} horas de duração explícita`),`${semDuracao} atividades de consultoria sem duração explícita. Horas mínimas ou previstas não substituem horas comprovadas. Conferir a vinculação ao objetivo de consultoria e a cada consultor/mês.`].join('; ');
  }
  if(meta.indicador==='sistema')resultado='A existência de cadastros e prestações mensais no portal não comprova, por si só, o manual digital e a emissão de relatório trimestral de acompanhamento. Informar a referência e a data dos relatórios e do manual nas evidências.';
  if(meta.indicador==='qualitativo')resultado='Visitas, eventos e entrega de insumos são registros de atividades. A melhoria de manejo, produção, renda e permanência no campo exige evidências de resultados e acompanhamento; não é presumida automaticamente.';
  const p=pareceres[meta.id];if(p&&p.situacao!=='automatico'){situacao=({'realizada':'REALIZADA - DECLARAÇÃO DO RESPONSÁVEL','parcial':'PARCIALMENTE REALIZADA - DECLARAÇÃO DO RESPONSÁVEL','nao-realizada':'NÃO REALIZADA - DECLARAÇÃO DO RESPONSÁVEL'} as const)[p.situacao];}
  return {meta,situacao,resultado,evidencia:p?.evidencia?.trim()||'',justificativa:p?.justificativa?.trim()||'',declarado:!!p&&p.situacao!=='automatico'};
 });
}
