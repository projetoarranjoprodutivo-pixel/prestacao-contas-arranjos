"use client";
import {useState} from "react";

export default function ExcluirEntregaButton({prestacaoId,atividadeIndex,retorno,compacto=false}:{prestacaoId:number;atividadeIndex:number;retorno:string;compacto?:boolean}){
 const[excluindo,setExcluindo]=useState(false);
 async function excluir(){if(!confirm("CONFIRMA A EXCLUSÃO DESTA ENTREGA DE MUDAS? ESTA AÇÃO NÃO PODERÁ SER DESFEITA."))return;setExcluindo(true);const f=new FormData();f.set("acao","excluir");f.set("prestacaoId",String(prestacaoId));f.set("atividadeIndex",String(atividadeIndex));const r=await fetch("/api/admin/entrega-mudas/editar",{method:"POST",body:f});const b=await r.json().catch(()=>({}));if(!r.ok){alert(b.message||"NÃO FOI POSSÍVEL EXCLUIR.");setExcluindo(false);return}location.href=retorno;}
 return <button type="button" onClick={excluir} disabled={excluindo} className={compacto?"rounded-lg bg-red-700 px-3 py-2 text-xs font-black text-white disabled:opacity-50":"h-12 rounded-xl border-2 border-red-700 bg-white font-black text-red-700 disabled:opacity-50"}>{excluindo?"EXCLUINDO...":"EXCLUIR"}</button>;
}
