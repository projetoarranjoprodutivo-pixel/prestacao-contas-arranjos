"use client";

import { useMemo, useState } from "react";

const MESES = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];

export default function CompetenciasFiltro({aba,iniciais,disponiveis}:{aba:string;iniciais:string[];disponiveis:string[]}){
  const anoInicial=(iniciais[0]||disponiveis[0]||String(new Date().getFullYear())).slice(0,4);
  const [ano,setAno]=useState(anoInicial);
  const [meses,setMeses]=useState(()=>new Set(iniciais.filter(item=>item.startsWith(`${anoInicial}-`)).map(item=>Number(item.slice(5,7)))));
  const anos=useMemo(()=>[...new Set([anoInicial,...disponiveis.map(item=>item.slice(0,4))])].filter(item=>/^\d{4}$/.test(item)).sort().reverse(),[anoInicial,disponiveis]);
  const selecionadas=[...meses].sort((a,b)=>a-b).map(mes=>`${ano}-${String(mes).padStart(2,"0")}`);
  function alternarMes(mes:number){setMeses(atuais=>{const proximos=new Set(atuais);if(proximos.has(mes))proximos.delete(mes);else proximos.add(mes);return proximos;});}
  function alternarTodos(){setMeses(atuais=>atuais.size===12?new Set():new Set(MESES.map((_,indice)=>indice+1)));}
  function alterarAno(novoAno:string){setAno(novoAno);const disponiveisNoAno=disponiveis.filter(item=>item.startsWith(`${novoAno}-`)).map(item=>Number(item.slice(5,7)));setMeses(new Set(disponiveisNoAno.length?disponiveisNoAno:[1]));}
  return <form className="grid w-full gap-3 sm:w-auto">
    <input type="hidden" name="aba" value={aba}/>
    {selecionadas.map(item=><input key={item} type="hidden" name="competencias" value={item}/>)}
    <div className="flex flex-wrap items-end gap-3"><label className="text-sm font-bold">ANO<select value={ano} onChange={e=>alterarAno(e.target.value)} className="mt-1 block h-11 min-w-28 rounded-lg border bg-white px-3">{anos.map(item=><option key={item} value={item}>{item}</option>)}</select></label><button disabled={!selecionadas.length} className="h-11 rounded-lg bg-emerald-700 px-5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">CONSULTAR</button></div>
    <fieldset className="rounded-xl border bg-white p-3"><legend className="px-1 text-sm font-bold">MESES</legend><label className="mb-3 flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-700 bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-950"><input type="checkbox" checked={meses.size===12} onChange={alternarTodos} className="h-4 w-4 accent-emerald-700"/>SELECIONAR TODOS</label><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{MESES.map((nome,indice)=>{const mes=indice+1;return <label key={nome} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${meses.has(mes)?"border-emerald-700 bg-emerald-50 text-emerald-950":"border-slate-200 text-slate-600"}`}><input type="checkbox" checked={meses.has(mes)} onChange={()=>alternarMes(mes)} className="h-4 w-4 accent-emerald-700"/>{nome}</label>})}</div></fieldset>
  </form>;
}
