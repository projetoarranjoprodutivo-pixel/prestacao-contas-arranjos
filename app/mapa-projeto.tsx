"use client";
import {useEffect,useMemo,useState} from "react";
import {MapPin,Search,Users,Sprout,Activity,ArrowUpRight} from "lucide-react";
import malha from "@/data/mapa-es.json";
import {MUNICIPIOS_POR_ASSOCIACAO,chaveMunicipio} from "@/lib/associacoes-municipios";
import type {MunicipioMapa} from "@/lib/mapa-municipios";
const numero=(valor:number)=>valor.toLocaleString("pt-BR",{maximumFractionDigits:2});
const iniciais:MunicipioMapa[]=MUNICIPIOS_POR_ASSOCIACAO.flatMap(([associacao,municipios])=>municipios.map(nome=>({nome,associacoes:[associacao],tecnicos:[],atendimentos:0,produtores:0,mudas:0,tiposMudas:{},eventos:0,ultimaCompetencia:""})));
iniciais.push({nome:"BARRA DE SÃO FRANCISCO",associacoes:[],tecnicos:[],atendimentos:0,produtores:0,mudas:0,tiposMudas:{},eventos:0,ultimaCompetencia:""});
export default function MapaProjeto(){
 const [dados,setDados]=useState(iniciais),[selecionado,setSelecionado]=useState(""),[hover,setHover]=useState(""),[busca,setBusca]=useState(""),[estado,setEstado]=useState<"carregando"|"ok"|"erro">("carregando");
 useEffect(()=>{
  const controller=new AbortController();let consultando=false;
  const atualizar=async()=>{if(consultando||document.hidden)return;consultando=true;try{const resposta=await fetch('/api/mapa-municipios',{signal:controller.signal,cache:'no-store'});if(!resposta.ok)throw new Error();const dados=await resposta.json() as {municipios:MunicipioMapa[]};if(!controller.signal.aborted){setDados(dados.municipios);setEstado('ok');}}catch(error){if(!controller.signal.aborted)setEstado('erro');}finally{consultando=false;}};
  void atualizar();const intervalo=window.setInterval(()=>void atualizar(),15000);
  const aoVoltar=()=>{if(!document.hidden)void atualizar();};
  window.addEventListener('focus',aoVoltar);document.addEventListener('visibilitychange',aoVoltar);
  return()=>{controller.abort();window.clearInterval(intervalo);window.removeEventListener('focus',aoVoltar);document.removeEventListener('visibilitychange',aoVoltar);};
 },[]);

 const porNome=useMemo(()=>new Map(dados.map(m=>[chaveMunicipio(m.nome),m])),[dados]);
 const alvo=hover||selecionado;const municipio=porNome.get(alvo);const forma=malha.find(m=>chaveMunicipio(m.nome)===alvo);
 const atendidos=malha.filter(m=>porNome.has(chaveMunicipio(m.nome)));
 const filtrados=atendidos.filter(m=>chaveMunicipio(m.nome).includes(chaveMunicipio(busca)));
 const totais=dados.reduce((t,m)=>({atendimentos:t.atendimentos+m.atendimentos,mudas:t.mudas+m.mudas}),{atendimentos:0,mudas:0});
 const selecionar=(nome:string)=>{setSelecionado(chaveMunicipio(nome));setHover("")};
 return <section id="mapa-projeto" aria-label="Mapa dos municípios atendidos" className="mx-auto w-full max-w-[1600px] px-5 pb-4 lg:min-h-0 lg:px-7 lg:pb-3">
  <div className="overflow-hidden rounded-3xl lg:grid lg:h-full lg:min-h-0 lg:grid-rows-[auto_minmax(0,1fr)] border border-emerald-900/10 bg-white shadow-[0_16px_60px_rgba(18,59,42,.08)]">
   <div className="flex flex-wrap items-end justify-between gap-5 border-b border-emerald-100 px-5 py-3"><div><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">Arranjos Produtivos no território</p><h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">O projeto nos municípios</h2><p className="mt-1 max-w-2xl text-xs text-slate-600">Explore o Espírito Santo. Passe o mouse ou toque em um município para conhecer o atendimento.</p></div><span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-900">{atendidos.length} municípios atendidos</span></div>
   <div className="grid lg:min-h-0 lg:grid-cols-[1fr_1fr]">
    <div className="relative border-b bg-[#edf5f3] p-3 lg:flex lg:min-h-0 lg:flex-col lg:border-b-0 lg:border-r border-emerald-100">
     <div className="absolute left-6 top-6 z-10 rounded-xl bg-white/90 px-3 py-2 text-xs font-bold text-emerald-950">ESPÍRITO SANTO <span className="ml-3 text-slate-400">N ↑</span></div>
     <svg viewBox="0 0 540 740" role="group" aria-label="Municípios do Espírito Santo" className="mx-auto max-h-[600px] w-full lg:min-h-0 lg:flex-1 lg:max-h-none" onMouseLeave={()=>setHover("")}>
      <text x="410" y="430" fill="#8aa7a0" fontSize="12" transform="rotate(-65 410 430)">OCEANO ATLÂNTICO</text>
      {malha.map(m=>{const chave=chaveMunicipio(m.nome),ativo=porNome.has(chave),foco=alvo===chave;return <path key={m.id} d={m.path} role="button" tabIndex={0} aria-label={`${m.nome}${ativo?", atendido pelo projeto":", fora da cobertura cadastrada"}`} aria-pressed={selecionado===chave} fill={foco?"#e6b44a":ativo?"#217a59":"#d0dcd7"} stroke={foco?"#794f08":"#fff"} strokeWidth={foco?2:1} className="cursor-pointer outline-none transition-colors focus:fill-amber-400" onMouseEnter={()=>setHover(chave)} onFocus={()=>setHover(chave)} onBlur={()=>setHover("")} onClick={()=>selecionar(m.nome)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selecionar(m.nome)}}}><title>{m.nome}{ativo?" · Projeto Arranjos Produtivos":""}</title></path>})}
     </svg>
     <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-600"><span><i className="mr-2 inline-block h-3 w-3 rounded-sm bg-[#217a59]"/>Atendido</span><span><i className="mr-2 inline-block h-3 w-3 rounded-sm bg-[#e6b44a]"/>Selecionado</span><span><i className="mr-2 inline-block h-3 w-3 rounded-sm bg-[#d0dcd7]"/>Fora da cobertura cadastrada</span></div>
     <p className="mt-3 text-center text-[11px] text-slate-500">Limites municipais: IBGE · Indicadores: registros do portal · atualização automática a cada 15 s</p>
    </div>
    <div className="p-4 lg:min-h-0 lg:overflow-y-auto">
     <label className="block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor="busca-municipio">Encontre seu município</label><div className="relative mt-2"><Search className="absolute left-3 top-3 h-5 w-5 text-emerald-700"/><input id="busca-municipio" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Digite o nome do município" className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm focus:border-emerald-600"/></div>
     <label className="sr-only" htmlFor="selecao-municipio">Selecionar município atendido</label><select id="selecao-municipio" value={selecionado} onChange={e=>selecionar(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="">Selecione um município atendido</option>{filtrados.map(m=><option key={m.id} value={chaveMunicipio(m.nome)}>{m.nome}</option>)}</select>
     {estado!=="ok"&&<p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{estado==="carregando"?"Consultando os indicadores do projeto…":"Indicadores temporariamente indisponíveis. Tente atualizar a página."}</p>}
     <div className="mt-4" aria-live="polite">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-700"><MapPin className="h-4 w-4"/>{alvo?"Município selecionado":"Visão geral do projeto"}</p><h3 className="mt-1 text-2xl font-bold text-[#123b2a]">{forma?.nome||"Espírito Santo"}</h3>
      {!alvo&&<p className="mt-3 text-sm leading-6 text-slate-600">Cada área verde representa um município atendido. Selecione no mapa ou na lista para ver sua associação, equipe e resultados.</p>}
      {alvo&&!municipio&&<p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Este município não consta na cobertura cadastrada do projeto.</p>}
      {(!alvo||municipio)&&<><div className="mt-3 grid grid-cols-2 gap-2"><Indicador icon={<Activity className="h-5 w-5"/>} rotulo="Atendimentos realizados" valor={estado==="ok"?numero(municipio?.atendimentos??totais.atendimentos):"—"}/><Indicador icon={<Sprout className="h-5 w-5"/>} rotulo="Mudas entregues" valor={estado==="ok"?numero(municipio?.mudas??totais.mudas):"—"}/>{municipio&&<><Indicador icon={<Users className="h-5 w-5"/>} rotulo="Produtores únicos atendidos" valor={estado==="ok"?numero(municipio.produtores):"—"}/><Indicador icon={<ArrowUpRight className="h-5 w-5"/>} rotulo="Eventos e ações coletivas" valor={estado==="ok"?numero(municipio.eventos):"—"}/></>}</div>
      {municipio&&<div className="mt-3 space-y-2 text-xs"><div><p className="text-xs font-bold uppercase text-slate-500">Associação</p><p className="mt-1 font-bold text-emerald-900">{municipio.associacoes.join(" · ")||"Vinculação da associação ainda não informada"}</p></div><div><p className="text-xs font-bold uppercase text-slate-500">Equipe técnica atual</p><p className="mt-1 leading-6">{estado==="ok"?(municipio.tecnicos.join(" · ")||"Sem técnico vinculado ao município no cadastro."):"Consultando…"}</p></div>{Object.keys(municipio.tiposMudas).length>0&&<div><p className="text-xs font-bold uppercase text-slate-500">Mudas por cultura</p><div className="mt-2 flex flex-wrap gap-2">{Object.entries(municipio.tiposMudas).map(([tipo,q])=><span key={tipo} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">{tipo}: {numero(q)}</span>)}</div></div>}<p className="border-t pt-3 text-xs text-slate-500">Última competência com atividade: {municipio.ultimaCompetencia||"sem registro"}</p></div>}
      <p className="mt-3 text-[10px] leading-4 text-slate-500">Todos os períodos registrados. Atendimentos = visitas técnicas executadas. Produtores únicos são identificados pelo nome dentro de cada município; não equivalem necessariamente ao número de famílias. Mudas = lançamentos oficiais do consolidado administrativo, em todas as competências. Quantidades não informadas não entram no total.</p></>}
     </div>
    </div>
   </div>
  </div>
 </section>;
}
function Indicador({rotulo,valor,icon}:{rotulo:string;valor:string;icon:React.ReactNode}){return <div className="rounded-xl bg-[#f2f7f3] p-3"><span className="text-emerald-700">{icon}</span><p className="mt-1 text-xl font-bold tracking-tight text-[#123b2a]">{valor}</p><p className="mt-1 text-[11px] leading-4 text-slate-600">{rotulo}</p></div>}
