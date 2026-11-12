"use client";
import {useEffect,useState} from "react";
import {ArrowLeft,ArrowUpRight,Download,FileText,Landmark,MapPin,Printer,RefreshCw,Search,Sprout} from "lucide-react";
import type {DadosTransparencia} from "@/lib/transparencia";
const meses=["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
const numero=(v:number)=>v.toLocaleString("pt-BR");
const moeda=(v:number)=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const competencia=(v:string)=>v?`${v.slice(5,7)}/${v.slice(0,4)}`:"NÃO INFORMADA";
const normal=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
export default function PainelTransparencia(){
 const atual=new Intl.DateTimeFormat("en",{timeZone:"America/Sao_Paulo",year:"numeric"}).format(new Date());
 const [ano,setAno]=useState(atual),[mes,setMes]=useState(""),[associacao,setAssociacao]=useState(""),[dados,setDados]=useState<DadosTransparencia|null>(null),[erro,setErro]=useState(""),[carregando,setCarregando]=useState(true),[versao,setVersao]=useState(0),[pesquisa,setPesquisa]=useState("");
 useEffect(()=>{let anteriores:Array<[HTMLDetailsElement,boolean]>=[];const preparar=()=>{anteriores=Array.from(document.querySelectorAll('details')).map(d=>[d,d.open]);for(const [d] of anteriores)d.open=true;};const restaurar=()=>{for(const [d,aberto] of anteriores)d.open=aberto;anteriores=[];};window.addEventListener('beforeprint',preparar);window.addEventListener('afterprint',restaurar);return()=>{window.removeEventListener('beforeprint',preparar);window.removeEventListener('afterprint',restaurar);restaurar();};},[]);
 useEffect(()=>{const controlador=new AbortController();let ativo=true;setCarregando(true);setErro("");setDados(null);
  const query=new URLSearchParams({ano,mes,associacao});
  fetch(`/api/transparencia?${query}`,{cache:"no-store",signal:controlador.signal}).then(async r=>{const d=await r.json() as DadosTransparencia & {message?:string};if(!r.ok)throw new Error(d.message||"NÃO FOI POSSÍVEL CONSULTAR OS DADOS.");return d as DadosTransparencia;}).then(d=>{if(ativo)setDados(d);}).catch(e=>{if(ativo&&e.name!=="AbortError")setErro(e.message);}).finally(()=>{if(ativo)setCarregando(false);});
  return()=>{ativo=false;controlador.abort();};
 },[ano,mes,associacao,versao]);
 const [opcoes,setOpcoes]=useState<Array<{nome:string}>>([]);useEffect(()=>{if(dados)setOpcoes(dados.opcoes);},[dados]);
 const resumo=dados?.resumo,periodo=mes?`${meses[Number(mes)-1]} DE ${ano}`:`ANO ${ano}`;
 const busca=normal(pesquisa.trim());const financeiro=(dados?.financeiro||[]).filter(r=>normal(`${r.associacao} ${r.categoria} ${competencia(r.competencia)}`).includes(busca));
 const financeiroPorAssociacao = new Map<string,{associacao:string;mudas:number;servicos:number;outras:number;notas:number;valor:number;semValor:number}>();
 for (const r of financeiro) {
  const total=financeiroPorAssociacao.get(r.associacao)||{associacao:r.associacao,mudas:0,servicos:0,outras:0,notas:0,valor:0,semValor:0};
  const campo=r.categoria==="COMPRA DE MUDAS"?"mudas":r.categoria==="SERVIÇOS"?"servicos":"outras";
  total[campo]+=r.valor;total.notas+=r.notas;total.valor+=r.valor;total.semValor+=r.semValor;
  financeiroPorAssociacao.set(r.associacao,total);
 }
 const valoresTermos=new Map((dados?.termos||[]).map(t=>[t.associacao,t.valorTermo]));
 for(const associacao of valoresTermos.keys()){
  if(!financeiroPorAssociacao.has(associacao)&&normal(associacao).includes(busca)){
   financeiroPorAssociacao.set(associacao,{associacao,mudas:0,servicos:0,outras:0,notas:0,valor:0,semValor:0});
  }
 }
 const totaisFinanceiros=[...financeiroPorAssociacao.values()].sort((a,b)=>a.associacao.localeCompare(b.associacao,"pt-BR"));
 const valorTermo=(associacao:string)=>valoresTermos.get(associacao)??null;
 const totalDocumentado=totaisFinanceiros.reduce((s,r)=>s+r.valor,0);
 const termosInformados=totaisFinanceiros.flatMap(r=>{
  const valor=valorTermo(r.associacao);
  return valor===null?[]:[valor];
 });
 const totalTermos=termosInformados.length
  ?moeda(termosInformados.reduce((s,valor)=>s+valor,0))+(termosInformados.length<totaisFinanceiros.length?" · PARCIAL":"")
  :"NÃO INFORMADO";
 const moedaTermo=(associacao:string)=>{
  const valor=valorTermo(associacao);
  return valor===null?"NÃO INFORMADO":moeda(valor);
 };
 const colunasFinanceiras=["ASSOCIAÇÃO","COMPRA DE MUDAS","SERVIÇOS","OUTRAS NOTAS","NOTAS","VALOR DOCUMENTADO","VALOR DO TERMO"];

 const execucao=(dados?.execucao||[]).filter(r=>normal(`${r.associacao} ${competencia(r.competencia)}`).includes(busca));
 const colunasExecucao=["ASSOCIAÇÃO","COMPETÊNCIA","RELATÓRIOS","SEM ATIVIDADES INDIVIDUALIZADAS","VISITAS TÉCNICAS","DIAS DE CAMPO","SEMINÁRIOS","CAPACITAÇÕES","ENTREGAS OFICIAIS","OUTRAS ATIVIDADES"];
 type Execucao=DadosTransparencia["execucao"][number];
 const camposExecucao=["relatorios","relatoriosSemAtividades","visitas","diasDeCampo","seminarios","capacitacoes","entregas","outras"] as const;
 const somarExecucao=(linhas:Execucao[])=>camposExecucao.map(campo=>linhas.reduce((total,linha)=>total+linha[campo],0));
 const execucaoPorAssociacao=new Map<string,Execucao[]>();
 for(const linha of execucao){
  const grupo=execucaoPorAssociacao.get(linha.associacao);
  if(grupo)grupo.push(linha);
  else execucaoPorAssociacao.set(linha.associacao,[linha]);
 }
 const linhasExecucao=[...execucaoPorAssociacao].sort(([a],[b])=>a.localeCompare(b,"pt-BR")).flatMap(([nome,linhas])=>[
  ...linhas.sort((a,b)=>a.competencia.localeCompare(b.competencia)).map(r=>({
   subtotal:false,celulas:[nome,competencia(r.competencia),...camposExecucao.map(campo=>r[campo])],
  })),
  {subtotal:true,celulas:[nome,"SUBTOTAL",...somarExecucao(linhas)]},
 ]);
 const totalExecucao=somarExecucao(execucao);
 const territorios=(dados?.territorios||[]).filter(r=>normal(`${r.associacao} ${r.municipio}`).includes(busca));
 type Territorio=DadosTransparencia["territorios"][number];
 const porAssociacao=new Map<string,Territorio[]>();
 for(const linha of territorios){
  const grupo=porAssociacao.get(linha.associacao);
  if(grupo)grupo.push(linha);
  else porAssociacao.set(linha.associacao,[linha]);
 }
 const contarResultados=(linhas:Territorio[])=>[
  linhas.reduce((s,r)=>s+r.visitas,0),
  new Set(linhas.flatMap(r=>r.produtoresIds)).size,
  linhas.reduce((s,r)=>s+r.mudas,0),
  new Set(linhas.flatMap(r=>r.eventosIds)).size,
 ];
 const linhasMunicipios=[...porAssociacao].flatMap(([nome,linhas])=>[
  ...linhas.map(r=>({subtotal:false,celulas:[r.associacao,r.municipio,r.visitas,r.agricultores,r.mudas,r.eventos]})),
  {subtotal:true,celulas:[nome,"SUBTOTAL",...contarResultados(linhas)]},
 ]);
 const totalMunicipios=contarResultados(territorios);
 function exportar(){if(!dados)return;
  const linhas:unknown[][]=[["TRANSPARÊNCIA - ARRANJOS PRODUTIVOS"],["PERÍODO",periodo],["ASSOCIAÇÃO",associacao||"TODAS"],["CONSULTADO EM",dados.atualizadoEm],[],["RESUMO","QUANTIDADE"],...[['ASSOCIAÇÕES',dados.resumo.associacoes],['MUNICÍPIOS COM EXECUÇÃO',dados.resumo.municipios],['RELATÓRIOS MENSAIS',dados.resumo.relatorios],['VISITAS TÉCNICAS',dados.resumo.visitas],['AGRICULTORES ÚNICOS',dados.resumo.agricultores],['PROPRIEDADES ÚNICAS',dados.resumo.propriedades],['MUDAS ENTREGUES',dados.resumo.mudas],['EVENTOS',dados.resumo.eventos]],[],["VALORES DOCUMENTADOS EM NOTAS FISCAIS"],[...colunasFinanceiras,"NOTAS SEM VALOR"],...totaisFinanceiros.map(r=>[r.associacao,...[r.mudas,r.servicos,r.outras].map(valor=>valor.toFixed(2).replace(".",",")),r.notas,r.valor.toFixed(2).replace(".",","),valorTermo(r.associacao)?.toFixed(2).replace(".",",")??"NÃO INFORMADO",r.semValor]),[],["EXECUÇÃO POR COMPETÊNCIA"],colunasExecucao,...linhasExecucao.map(r=>r.celulas),...(execucao.length?[["TOTAL GERAL","",...totalExecucao]]:[]),[],["EXECUÇÃO POR MUNICÍPIO"],["ASSOCIAÇÃO","MUNICÍPIO","VISITAS","AGRICULTORES ÚNICOS","MUDAS ENTREGUES","EVENTOS"],...linhasMunicipios.map(r=>r.celulas),...(territorios.length?[["TOTAL GERAL","",...totalMunicipios]]:[]),[],["TERMOS, OBJETIVOS E METAS"],["ASSOCIAÇÃO","TERMO","INÍCIO","TÉRMINO","META","PREVISÃO","SITUAÇÃO","RESULTADO","REFERÊNCIA"],...dados.termos.flatMap(t=>t.metas.length?t.metas.map(m=>[t.associacao,t.numero,competencia(t.inicio),competencia(t.termino),m.titulo,m.meta,m.situacao,m.resultado,m.fonte]):[[t.associacao,t.numero,"","","METAS NÃO IDENTIFICADAS"]])];
  const celula=(v:unknown)=>{let s=String(v??"");if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
  const blob=new Blob(["\uFEFF"+linhas.map(l=>l.map(celula).join(';')).join('\r\n')],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`transparencia-${ano}${mes?'-'+mes:''}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
 }
 return <main className="min-h-screen bg-[#f3f6f4] text-slate-900">
  <style>{`@media print{.transparencia-acoes,.transparencia-filtros,.transparencia-menu{display:none!important}details{break-inside:auto}details>*{display:block!important}table{font-size:9px!important}main{background:white!important}.transparencia-hero{background:#123b2a!important;color:white!important;print-color-adjust:exact}section{break-inside:auto}thead{display:table-header-group}tr{break-inside:avoid}}`}</style>
  <a href="#conteudo-transparencia" className="sr-only focus:not-sr-only focus:block focus:bg-white focus:p-4">IR PARA O CONTEÚDO</a>
  <header className="transparencia-hero border-b-4 border-[#e6b44a] bg-[#123b2a] text-white"><div className="mx-auto max-w-7xl px-5 py-5 sm:px-8">
   <div className="flex flex-wrap items-center justify-between gap-4"><a href="/" className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e6b44a] text-lg font-black text-[#123b2a]">AP</span><span className="text-sm font-bold tracking-wide">ARRANJOS PRODUTIVOS<span className="mt-1 block text-[11px] font-normal text-emerald-100">AGRICULTURA FAMILIAR · ESPÍRITO SANTO</span></span></a><a href="/admin" className="transparencia-acoes inline-flex items-center gap-2 rounded-lg border border-white/30 px-3 py-2 text-xs font-bold"><ArrowLeft size={14}/>VOLTAR AO SISTEMA</a></div>
   <div className="py-8 sm:py-10"><p className="text-xs font-bold tracking-[0.2em] text-[#e6b44a]">ACESSO ADMINISTRATIVO</p><h1 className="mt-3 text-3xl font-black sm:text-5xl">PORTAL DA TRANSPARÊNCIA</h1><p className="mt-4 max-w-2xl text-sm leading-relaxed text-emerald-100 sm:text-base">Acompanhe as associações, os valores documentados e os resultados do projeto nos municípios capixabas.</p><div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold"><span className="rounded-full bg-white/10 px-3 py-2">DADOS DO SISTEMA DE PRESTAÇÃO DE CONTAS</span></div></div>
  </div></header>
  <nav aria-label="ÁREAS DA TRANSPARÊNCIA" className="transparencia-menu border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-wrap gap-1 px-5 py-2 sm:px-8">{[['#visao-geral','VISÃO GERAL'],['#financeiro','INFORMAÇÕES FINANCEIRAS'],['#execucao','EXECUÇÃO POR COMPETÊNCIA'],['#resultados','RESULTADOS NOS MUNICÍPIOS'],['#metas','ASSOCIAÇÕES E METAS'],['#sobre-dados','SOBRE OS DADOS']].map(([href,nome])=><a key={href} href={href} className="rounded-lg px-3 py-3 text-xs font-bold text-emerald-900 hover:bg-emerald-50">{nome}</a>)}</div></nav>
  <div id="conteudo-transparencia" className="mx-auto max-w-7xl space-y-7 px-5 py-7 sm:px-8">
   <section className="transparencia-filtros rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="FILTROS DE CONSULTA"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-black text-emerald-900"><Search size={17}/>CONSULTE OS DADOS</h2><div className="transparencia-acoes flex gap-2"><button onClick={exportar} disabled={!dados||carregando} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-emerald-800 px-3 text-xs font-bold text-emerald-900 disabled:opacity-40"><Download size={15}/>EXPORTAR CSV</button><button onClick={()=>window.print()} disabled={!dados} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-bold disabled:opacity-40"><Printer size={15}/>IMPRIMIR / PDF</button></div></div>
    <div className="mt-4 grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[0.7fr_1fr_1.7fr_auto]"><label className="text-xs font-bold text-slate-600">ANO<input type="number" min="2000" max="2100" value={ano} onChange={e=>setAno(e.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900"/></label><label className="text-xs font-bold text-slate-600">COMPETÊNCIA<select value={mes} onChange={e=>setMes(e.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"><option value="">TODAS AS COMPETÊNCIAS</option>{meses.map((m,i)=><option key={m} value={String(i+1).padStart(2,'0')}>{m}</option>)}</select></label><label className="text-xs font-bold text-slate-600">ASSOCIAÇÃO<select value={associacao} onChange={e=>setAssociacao(e.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"><option value="">TODAS AS ASSOCIAÇÕES</option>{opcoes.map(o=><option key={o.nome}>{o.nome}</option>)}</select></label><button onClick={()=>setVersao(v=>v+1)} disabled={carregando} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-800 px-5 text-xs font-bold text-white disabled:opacity-50"><RefreshCw size={15} className={carregando?'animate-spin':''}/>ATUALIZAR DADOS</button></div>
   </section>
   <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-600"><p className="font-bold">{periodo} · {associacao||"TODAS AS ASSOCIAÇÕES"}</p>{dados&&<p>CONSULTADO EM {new Date(dados.atualizadoEm).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</p>}</div>
   {carregando&&<div role="status" className="rounded-xl border border-emerald-200 bg-white p-8 text-center font-bold text-emerald-900">CONSULTANDO OS REGISTROS DO SISTEMA…</div>}
   {erro&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 font-bold text-red-900">{erro}<button onClick={()=>setVersao(v=>v+1)} className="ml-3 underline">TENTAR NOVAMENTE</button></div>}
   {dados&&resumo&&<>
    <section id="visao-geral" className="scroll-mt-5"><Titulo numero="01" titulo="VISÃO GERAL" texto="Indicadores consolidados no período selecionado."/><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[
     {rotulo:'VALOR DOCUMENTADO EM NOTAS',valor:moeda(resumo.valorNotas),detalhe:`${numero(resumo.notas)} NOTA(S) CADASTRADA(S)`,icon:Landmark,destaque:true},
     {rotulo:'MUDAS ENTREGUES',valor:numero(resumo.mudas),detalhe:'LANÇAMENTOS OFICIAIS DE ENTREGA',icon:Sprout},
     {rotulo:'AGRICULTORES ATENDIDOS',valor:numero(resumo.agricultores),detalhe:'NOMES ÚNICOS NAS VISITAS',icon:MapPin},
     {rotulo:'RELATÓRIOS MENSAIS',valor:numero(resumo.relatorios),detalhe:`${numero(resumo.associacoes)} ASSOCIAÇÕES CADASTRADAS`,icon:FileText},
    ].map(c=><article key={c.rotulo} className={`min-w-0 rounded-2xl border p-5 shadow-sm ${c.destaque?'border-emerald-800 bg-emerald-800 text-white':'border-slate-200 bg-white text-slate-900'}`}><div className="flex justify-between gap-2"><p className={`text-[11px] font-bold ${c.destaque?'text-emerald-100':'text-slate-500'}`}>{c.rotulo}</p><c.icon size={19} className={c.destaque?'text-[#e6b44a]':'text-emerald-700'}/></div><p className="mt-5 break-words text-2xl font-black xl:text-3xl">{c.valor}</p><p className={`mt-3 text-[10px] font-semibold ${c.destaque?'text-emerald-100':'text-slate-500'}`}>{c.detalhe}</p></article>)}</div>
     <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 text-center sm:grid-cols-4">{[['MUNICÍPIOS COM EXECUÇÃO',resumo.municipios],['VISITAS TÉCNICAS',resumo.visitas],['PROPRIEDADES IDENTIFICADAS',resumo.propriedades],['EVENTOS REGISTRADOS',resumo.eventos]].map(([r,v])=><div key={String(r)}><p className="text-xl font-black text-emerald-800">{numero(Number(v))}</p><p className="mt-1 text-[10px] font-bold text-slate-500">{r}</p></div>)}</div>
    </section>
    <div className="transparencia-filtros"><label className="block text-xs font-bold text-slate-600">PESQUISAR NAS TABELAS<input value={pesquisa} onChange={e=>setPesquisa(e.target.value)} placeholder="ASSOCIAÇÃO, MUNICÍPIO, COMPETÊNCIA OU CATEGORIA" className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-sm"/></label></div>
    <section id="financeiro" className="scroll-mt-5"><Titulo numero="02" titulo="INFORMAÇÕES FINANCEIRAS" texto="Valores documentados por associação no período selecionado."/><div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs leading-relaxed text-slate-600">O VALOR DO TERMO CORRESPONDE AO TOTAL PACTUADO. O VALOR DOCUMENTADO CORRESPONDE ÀS NOTAS REGISTRADAS NO PERÍODO.</p>{resumo.notasSemValor>0&&<p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-bold text-amber-900">{numero(resumo.notasSemValor)} NOTA(S) SEM VALOR IDENTIFICADO, NÃO SOMADA(S) AO TOTAL.</p>}{resumo.remessasPendentes>0&&<p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs font-bold text-amber-900">{numero(resumo.remessasPendentes)} REMESSA(S) DE MUDAS AGUARDANDO CONFERÊNCIA DO FATURAMENTO.</p>}<Tabela cabecalho={colunasFinanceiras} linhas={totaisFinanceiros.map(r=>[r.associacao,moeda(r.mudas),moeda(r.servicos),moeda(r.outras),numero(r.notas),r.notas>0&&r.semValor===r.notas?'NÃO INFORMADO':moeda(r.valor)+(r.semValor?' · PARCIAL':''),moedaTermo(r.associacao)])} vazio="NENHUMA NOTA LOCALIZADA PARA ESTA CONSULTA." totais={[moeda(totalDocumentado),totalTermos]}/></div></section>
    <section id="execucao" className="scroll-mt-5">
     <Titulo numero="03" titulo="EXECUÇÃO POR ASSOCIAÇÃO E COMPETÊNCIA" texto="Consulte os relatórios entregues e as atividades registradas em cada mês."/>
     <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
      <Tabela cabecalho={colunasExecucao} linhas={linhasExecucao.map(r=>r.celulas.map(v=>typeof v==="number"?numero(v):v))} subtotais={linhasExecucao.map(r=>r.subtotal)} totais={totalExecucao.map(numero)} rotuloTotal="TOTAL GERAL" vazio="NENHUMA EXECUÇÃO LOCALIZADA PARA ESTA CONSULTA."/>
      <p className="mt-4 text-xs text-slate-600">OS RELATÓRIOS SEM ATIVIDADES INDIVIDUALIZADAS ENTRAM NO TOTAL DE RELATÓRIOS. A CONTAGEM DE VISITAS USA OS REGISTROS INDIVIDUAIS DE ATIVIDADES EXECUTADAS.</p>
     </div>
    </section>
    <section id="resultados" className="scroll-mt-5"><Titulo numero="04" titulo="RESULTADOS NOS MUNICÍPIOS" texto="Execução registrada nas prestações de contas e entregas oficiais."/><div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5"><Tabela cabecalho={['ASSOCIAÇÃO','MUNICÍPIO','VISITAS','AGRICULTORES','MUDAS ENTREGUES','EVENTOS']} linhas={linhasMunicipios.map(r=>r.celulas.map(c=>typeof c==="number"?numero(c):c))} subtotais={linhasMunicipios.map(r=>r.subtotal)} totais={totalMunicipios.map(numero)} rotuloTotal="TOTAL GERAL" vazio="NENHUMA EXECUÇÃO LOCALIZADA PARA ESTA CONSULTA."/><p className="mt-4 text-xs text-slate-500">AGRICULTORES E EVENTOS REPETIDOS CONTAM UMA VEZ EM CADA SUBTOTAL E NO TOTAL GERAL.</p></div></section>
    <section id="metas" className="scroll-mt-5"><Titulo numero="05" titulo="ASSOCIAÇÕES, TERMOS E METAS" texto="Objetivos e metas dos termos identificados no sistema, comparados com os registros selecionados."/><div className="mt-4 grid gap-4 lg:grid-cols-2">{dados.termos.map(t=><details key={t.associacao} className="self-start overflow-hidden rounded-2xl border border-slate-200 bg-white"><summary className="cursor-pointer p-5 text-sm font-black text-emerald-900">{t.associacao}<span className="mt-2 block text-[11px] font-semibold text-slate-500">{t.numero==='NÃO IDENTIFICADO'?'TERMO NÃO IDENTIFICADO':`TERMO ${t.numero} · ${competencia(t.inicio)} A ${competencia(t.termino)}`}</span></summary><div className="space-y-4 border-t p-5 text-xs"><div><p className="font-bold">{t.razaoSocial}</p><p className="mt-1 text-slate-500">CNPJ: {t.cnpj}</p></div><p className="leading-relaxed text-slate-600"><strong>MUNICÍPIOS DE ABRANGÊNCIA: </strong>{t.municipios.join(', ')||'NÃO INFORMADOS'}</p>{t.objetivo&&<p className="leading-relaxed text-slate-600"><strong>OBJETIVO: </strong>{t.objetivo}</p>}{!t.metas.length&&<p className="rounded-lg bg-slate-50 p-3 font-semibold text-slate-600">METAS AINDA NÃO IDENTIFICADAS NO TERMO CADASTRADO.</p>}{t.metas.map((m,i)=><article key={i} className="rounded-xl border border-slate-200 p-4"><h3 className="font-black">{m.titulo}</h3><p className="mt-2 leading-relaxed text-slate-600"><strong>META: </strong>{m.meta}</p><p className={`mt-3 rounded-lg p-2 text-[10px] font-bold leading-relaxed ${m.atingida?'bg-emerald-100 text-emerald-900':'bg-amber-50 text-amber-950'}`}>{m.situacao}</p><p className="mt-3 leading-relaxed text-slate-600">{m.resultado}</p><p className="mt-3 text-[10px] text-slate-500">FONTE: {m.fonte}</p></article>)}</div></details>)}</div><p className="mt-3 text-xs text-slate-500">A META QUANTITATIVA É COMPARADA COM OS REGISTROS DO PERÍODO. A ANÁLISE DOS ÓRGÃOS RESPONSÁVEIS PELA PRESTAÇÃO DE CONTAS SEGUE SEU PRÓPRIO FLUXO.</p></section>
   </>}
   <section id="sobre-dados" className="scroll-mt-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><Titulo numero="06" titulo="SOBRE OS DADOS" texto="Informações para interpretar esta consulta."/><div className="mt-5 grid gap-5 text-xs leading-relaxed text-slate-600 sm:grid-cols-2"><div><h3 className="font-black text-slate-900">ORIGEM E ATUALIZAÇÃO</h3><p className="mt-2">OS DADOS SÃO CONSULTADOS DIRETAMENTE NOS CADASTROS, PRESTAÇÕES, NOTAS FISCAIS E TERMOS DO SISTEMA. NOVOS LANÇAMENTOS APARECEM AO ABRIR A PÁGINA OU ACIONAR ATUALIZAR DADOS.</p><h3 className="mt-4 font-black text-slate-900">COMO SÃO CONTADOS</h3><p className="mt-2">NOMES REPETIDOS SÃO UNIFICADOS, DESCONSIDERANDO ACENTOS, MAIÚSCULAS E ESPAÇOS REPETIDOS. NA AUSÊNCIA DO NOME DA PROPRIEDADE, É UTILIZADO O NOME DO AGRICULTOR. ATIVIDADES NÃO EXECUTADAS NÃO ENTRAM NOS RESULTADOS.</p></div><div><h3 className="font-black text-slate-900">ACESSO À INFORMAÇÃO</h3><p className="mt-2">A CONSULTA EXIGE ACESSO ADMINISTRATIVO E PERMITE EXPORTAÇÃO EM CSV E IMPRESSÃO.</p><h3 className="mt-4 font-black text-slate-900">REFERÊNCIAS DE ORGANIZAÇÃO</h3><div className="mt-2 flex flex-wrap gap-3"><a className="inline-flex items-center gap-1 font-bold text-emerald-800 underline" href="https://portaldatransparencia.gov.br/convenios/consulta" target="_blank" rel="noreferrer">PORTAL DA TRANSPARÊNCIA FEDERAL<ArrowUpRight size={13}/></a><a className="inline-flex items-center gap-1 font-bold text-emerald-800 underline" href="https://convenios.es.gov.br/portal-de-convenios" target="_blank" rel="noreferrer">PORTAL DE CONVÊNIOS DO ES<ArrowUpRight size={13}/></a></div></div></div></section>
   <footer className="pb-4 text-center text-[10px] font-semibold text-slate-500">ARRANJOS PRODUTIVOS · PORTAL DA TRANSPARÊNCIA · ESPÍRITO SANTO</footer>
  </div>
 </main>;
}
function Titulo({numero,titulo,texto}:{numero:string;titulo:string;texto:string}){return <div className="flex gap-3"><span className="pt-0.5 text-xs font-black text-emerald-700">{numero}</span><div><h2 className="text-lg font-black sm:text-xl">{titulo}</h2><p className="mt-1 text-xs text-slate-500">{texto}</p></div></div>;}
function Tabela({cabecalho,linhas,vazio,totais,subtotais,rotuloTotal="TOTAL DA CONSULTA EXIBIDA"}:{cabecalho:string[];linhas:string[][];vazio:string;totais?:string[];subtotais?:boolean[];rotuloTotal?:string}){return <div className="mt-4 overflow-x-auto"><table className="w-full border-collapse text-left text-xs"><thead><tr className="border-b-2 border-emerald-800 bg-emerald-50">{cabecalho.map(c=><th key={c} scope="col" className="whitespace-nowrap px-3 py-3 text-[10px] font-black text-emerald-950">{c}</th>)}</tr></thead><tbody>{linhas.map((r,i)=><tr key={i} className={subtotais?.[i]?"border-b border-emerald-200 bg-emerald-50 font-bold text-emerald-900":"border-b border-slate-100 even:bg-slate-50"}>{r.map((c,j)=><td key={j} className={`px-3 py-3 ${j===0?'font-bold text-emerald-900':''}`}>{c}</td>)}</tr>)}{!linhas.length&&<tr><td colSpan={cabecalho.length} className="px-3 py-8 text-center font-semibold text-slate-500">{vazio}</td></tr>}</tbody>{totais&&linhas.length>0&&<tfoot><tr className="border-t-2 border-emerald-800 bg-emerald-50 font-black text-emerald-900"><th scope="row" colSpan={cabecalho.length-totais.length} className="px-3 py-3">{rotuloTotal}</th>{totais.map((total,i)=><td key={i} className="whitespace-nowrap px-3 py-3">{total}</td>)}</tr></tfoot>}</table></div>;}
