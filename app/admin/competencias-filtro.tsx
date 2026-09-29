"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

export default function CompetenciasFiltro({aba,iniciais,disponiveis}:{aba:string;iniciais:string[];disponiveis:string[]}){
  const [selecionadas,setSelecionadas]=useState(iniciais);
  const [nova,setNova]=useState("");
  function adicionar(){if(!/^\d{4}-\d{2}$/.test(nova))return;setSelecionadas(atuais=>[...new Set([...atuais,nova])].sort());setNova("");}
  function remover(valor:string){setSelecionadas(atuais=>atuais.length>1?atuais.filter(item=>item!==valor):atuais);}
  return <form className="grid w-full gap-2 sm:w-auto">
    <input type="hidden" name="aba" value={aba}/>
    {selecionadas.map(item=><input key={item} type="hidden" name="competencias" value={item}/>)}
    <div className="flex flex-wrap gap-2">{selecionadas.map(item=><span key={item} className="inline-flex items-center gap-2 rounded-lg bg-emerald-100 px-3 py-2 text-sm font-bold text-emerald-950">{item}<button type="button" onClick={()=>remover(item)} title="REMOVER COMPETÊNCIA"><X className="h-4 w-4"/></button></span>)}</div>
    <div className="flex flex-wrap items-end gap-2"><label className="text-sm font-bold">ADICIONAR COMPETÊNCIA<input type="month" value={nova} onChange={e=>setNova(e.target.value)} list="competencias-painel" className="mt-1 block h-11 rounded-lg border bg-white px-3"/></label><datalist id="competencias-painel">{disponiveis.map(item=><option key={item} value={item}/>)}</datalist><button type="button" onClick={adicionar} className="inline-flex h-11 items-center gap-2 rounded-lg border border-emerald-700 px-4 font-bold text-emerald-800"><Plus className="h-4 w-4"/>ADICIONAR</button><button className="h-11 rounded-lg bg-emerald-700 px-5 font-bold text-white">CONSULTAR</button></div>
  </form>;
}
