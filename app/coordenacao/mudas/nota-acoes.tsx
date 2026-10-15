"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
type Nota = {key?:string;numeroNota?:string;descricao?:string;quantidade?:string;valor?:string;dataEmissao?:string};
function valorDecimal(valor?:string){const texto=String(valor||"").replace(/[^0-9,.-]/g,"");return texto.includes(",")?texto.replaceAll(".","").replace(",","."):texto;}
export default function NotaAcoes({documentoId,nota}:{documentoId:number;nota:Nota}) {
  const router=useRouter();
  const [editando,setEditando]=useState(false),[ocupado,setOcupado]=useState(false),[erro,setErro]=useState("");
  async function salvar(acao:"editar"|"excluir",form?:FormData){
    if(acao==="excluir"&&!confirm(`CONFIRMA EXCLUIR A NOTA ${nota.numeroNota||"SELECIONADA"}?`))return;
    setOcupado(true);setErro("");
    try{
      const resposta=await fetch("/api/coordenacao/mudas/notas",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({acao,documentoId,key:nota.key,...(form?Object.fromEntries(form):{})})});
      const dados=await resposta.json();if(!resposta.ok)throw Error(dados.message||"NÃO FOI POSSÍVEL SALVAR.");
      setEditando(false);router.refresh();
    }catch(e){setErro(e instanceof Error?e.message:"FALHA DE CONEXÃO.");}finally{setOcupado(false);}
  }
  return <div className="mt-2 space-y-2">
    <div className="flex flex-wrap gap-2"><button type="button" disabled={ocupado} onClick={()=>{setEditando(true);setErro("");}} className="rounded-lg bg-blue-800 px-3 py-2 text-xs font-black text-white disabled:opacity-50">EDITAR</button><button type="button" disabled={ocupado} onClick={()=>void salvar("excluir")} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50">EXCLUIR</button></div>
    {erro&&<p role="alert" className="text-sm text-red-800">{erro}</p>}
    {editando&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><section role="dialog" aria-modal="true" aria-label="Editar nota fiscal" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"><h2 className="text-xl font-black">EDITAR NOTA FISCAL</h2><form onSubmit={e=>{e.preventDefault();void salvar("editar",new FormData(e.currentTarget));}} className="mt-4 space-y-3">
      {([['numeroNota','NÚMERO DA NOTA'],['descricao','DESCRIÇÃO'],['quantidade','QUANTIDADE'],['valor','VALOR TOTAL (R$)'],['dataEmissao','DATA DE EMISSÃO']] as const).map(([campo,rotulo])=><label key={campo} className="block text-sm font-bold">{rotulo}<input name={campo} type={campo==="valor"?"number":campo==="dataEmissao"?"date":"text"} step={campo==="valor"?"0.01":undefined} min={campo==="valor"?"0":undefined} required={campo==="descricao"||campo==="valor"} defaultValue={campo==="valor"?valorDecimal(nota.valor):nota[campo]||""} className="mt-1 h-11 w-full rounded-lg border px-3"/></label>)}
      {erro&&<p role="alert" className="text-sm text-red-800">{erro}</p>}<div className="flex gap-2"><button disabled={ocupado} className="rounded-lg bg-emerald-800 px-4 py-3 font-bold text-white disabled:opacity-50">{ocupado?"SALVANDO...":"SALVAR"}</button><button type="button" disabled={ocupado} onClick={()=>setEditando(false)} className="rounded-lg border px-4 py-3 font-bold">CANCELAR</button></div>
    </form></section></div>}
  </div>;
}
