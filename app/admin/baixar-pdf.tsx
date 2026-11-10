"use client";
import {useState} from "react";
type Secao={heading?:string;lines:string[]};
export default function BaixarPdf({href,children,className}:{href:string;children:React.ReactNode;className?:string}){
 const [gerando,setGerando]=useState(false),[erro,setErro]=useState("");
 async function baixar(){
  if(gerando)return;setGerando(true);setErro("");
  try{
   const url=new URL(href,window.location.origin);url.searchParams.set("formato","json");
   const resposta=await fetch(url.pathname+url.search,{cache:"no-store"});
   if(!resposta.ok)throw new Error(resposta.status===401||resposta.status===403?"ENTRE NOVAMENTE NO SISTEMA PARA BAIXAR O PDF.":"NÃO FOI POSSÍVEL CONSULTAR OS REGISTROS. TENTE NOVAMENTE.");
   const dados=await resposta.json() as {titulo:string;secoes:Secao[];nomeArquivo:string};
   if(!Array.isArray(dados.secoes)||!dados.titulo)throw new Error("DADOS DO RELATÓRIO INVÁLIDOS.");
   const {createPdf}=await import("@/lib/pdf");
   const {PDFDocument,StandardFonts}=await import("pdf-lib");
   const documentoFonte=await PDFDocument.create(),fonte=await documentoFonte.embedFont(StandardFonts.Helvetica);
   const textoSeguro=(texto:string)=>Array.from(texto.replace(/[\uf0b7\uf0a7]/g,"•")).map(caractere=>{try{fonte.encodeText(caractere);return caractere;}catch{return caractere==="🚨"?"ALERTA":`[U+${caractere.codePointAt(0)!.toString(16).toUpperCase()}]`;}}).join("");
   const secoes=dados.secoes.map(s=>({...s,heading:s.heading?textoSeguro(s.heading):undefined,lines:s.lines.flatMap(linha=>{
    const partes:string[]=[];let atual="";
    for(const palavra of textoSeguro(linha).split(/\s+/)){if(atual.length+palavra.length>600&&atual){partes.push(atual);atual="";}atual+=(atual?" ":"")+palavra;}
    if(atual)partes.push(atual);return partes;
   })}));
   const bytes=await createPdf(textoSeguro(dados.titulo),secoes);
   const arquivo=new Blob([new Uint8Array(bytes)],{type:"application/pdf"}),endereco=URL.createObjectURL(arquivo),link=document.createElement("a");
   link.href=endereco;link.download=dados.nomeArquivo||"relatorio.pdf";document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(endereco),60000);
  }catch(e){setErro(e instanceof Error?e.message:"NÃO FOI POSSÍVEL GERAR O PDF.");}finally{setGerando(false);}
 }
 return <div><button type="button" onClick={()=>void baixar()} disabled={gerando} className={className} aria-busy={gerando}>{gerando?"GERANDO PDF…":children}</button>{erro&&<p role="alert" className="mt-2 max-w-sm text-xs font-bold text-red-800">{erro}</p>}</div>;
}
