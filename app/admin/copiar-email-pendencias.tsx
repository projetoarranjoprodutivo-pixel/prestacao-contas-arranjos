"use client";
import {useRef,useState} from "react";
export default function CopiarEmailPendencias({nome,mensagem,html}:{nome:string;mensagem:string;html:string}){
 const [status,setStatus]=useState(""),[mostrar,setMostrar]=useState(false);
 const conteudo=useRef<HTMLDivElement>(null);
 async function copiar(){
  try{
   if(!navigator.clipboard?.write||typeof ClipboardItem==="undefined")throw new Error("Clipboard indisponível");
   await navigator.clipboard.write([new ClipboardItem({"text/html":new Blob([html],{type:"text/html"}),"text/plain":new Blob([mensagem],{type:"text/plain"})})]);
   setStatus("MENSAGEM COPIADA. NO GMAIL, SUBSTITUA O TEXTO DO CORPO PELA MENSAGEM COPIADA PARA MANTER O NOME EM NEGRITO.");
  }catch{setMostrar(true);setStatus("SELECIONE E COPIE A MENSAGEM ABAIXO, DEPOIS COLE NO CORPO DO E-MAIL.");}
 }
 function selecionar(){const el=conteudo.current;if(!el)return;const range=document.createRange();range.selectNodeContents(el);const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range);}
 return <div className="mt-2"><button type="button" onClick={()=>void copiar()} aria-label={`Copiar mensagem formatada para ${nome}`} className="min-h-10 rounded-lg border border-emerald-800 px-3 py-2 text-xs font-bold text-emerald-900">COPIAR MENSAGEM FORMATADA</button><button type="button" onClick={()=>setMostrar(v=>!v)} className="ml-3 py-2 text-xs font-bold text-emerald-900 underline">{mostrar?"FECHAR MENSAGEM":"VER MENSAGEM"}</button>{status&&<p role="status" className="mt-2 text-xs font-semibold text-emerald-900">{status}</p>}{mostrar&&<div className="mt-3 rounded-lg border bg-white p-3 normal-case"><div ref={conteudo} dangerouslySetInnerHTML={{__html:html}}/><button type="button" onClick={selecionar} className="mt-3 text-xs font-bold text-emerald-900 underline">SELECIONAR MENSAGEM</button></div>}</div>;
}
