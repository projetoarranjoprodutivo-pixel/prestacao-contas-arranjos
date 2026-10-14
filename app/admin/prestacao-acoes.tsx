"use client";
import {useState} from "react";
import {Download,Trash2} from "lucide-react";

export default function PrestacaoAcoes({id,nome,competencia}:{id:number;nome:string;competencia:string}){
  const[excluindo,setExcluindo]=useState(false);
  async function excluir(){
    if(!confirm(`EXCLUIR A PRESTAÇÃO DE ${nome}, COMPETÊNCIA ${competencia}?\n\nESTA AÇÃO TAMBÉM EXCLUIRÁ OS ANEXOS E NÃO PODERÁ SER DESFEITA.`))return;
    setExcluindo(true);
    const resposta=await fetch(`/api/admin/prestacoes?id=${id}`,{method:"DELETE"});
    const dados=await resposta.json().catch(()=>({}));
    if(!resposta.ok){alert(dados.message||"NÃO FOI POSSÍVEL EXCLUIR A PRESTAÇÃO.");setExcluindo(false);return;}
    location.reload();
  }
  return <div className="ml-3 flex shrink-0 items-center gap-2">
    <a target="_blank" href={`/api/prestacao/pdf?id=${id}`} title="VISUALIZAR PDF" className="inline-flex h-10 items-center gap-1 rounded-lg bg-blue-800 px-3 text-xs font-black text-white"><Download className="h-4 w-4"/>PDF</a>
    <button type="button" onClick={excluir} disabled={excluindo} className="inline-flex h-10 items-center gap-1 rounded-lg bg-red-700 px-3 text-xs font-black text-white disabled:opacity-50"><Trash2 className="h-4 w-4"/>{excluindo?"EXCLUINDO...":"EXCLUIR"}</button>
  </div>;
}
