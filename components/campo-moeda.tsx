"use client";
import {useState,type InputHTMLAttributes} from "react";
import {formatarMoeda,valorMonetarioDecimal} from "@/lib/moeda";
type Props=Omit<InputHTMLAttributes<HTMLInputElement>,"type"|"value"|"defaultValue"|"onChange">&{value?:string;defaultValue?:string;onValueChange?:(valor:string)=>void};
export default function CampoMoeda({value,defaultValue="",onValueChange,onFocus,onBlur,...props}:Props){
 const [interno,setInterno]=useState(defaultValue),[editando,setEditando]=useState(false),[rascunho,setRascunho]=useState("");const atual=value??interno;
 return <input {...props} type="text" inputMode="decimal" value={editando?rascunho:formatarMoeda(atual,"")} onFocus={e=>{setRascunho(formatarMoeda(atual,""));setEditando(true);onFocus?.(e);}} onChange={e=>{const texto=e.target.value;setRascunho(texto);const decimal=valorMonetarioDecimal(texto);setInterno(decimal);onValueChange?.(decimal);}} onBlur={e=>{setEditando(false);onBlur?.(e);}}/>;
}
