"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import type {VinculoNotaServico} from "@/lib/notas-servico";

type Prestador = {id:number;nomeCompleto:string};

type Props = {
 arquivoKey: string;
 compraMudas?: boolean;
 categoria?: string;
 competenciaInicial?: string;
 vinculo?: VinculoNotaServico;
 prestadores?: Prestador[];
 origem?: string;
 destinos?: Record<string,Prestador[]>;
};

export default function ClassificarNota({arquivoKey,categoria,competenciaInicial,vinculo,prestadores,origem,destinos,compraMudas=false}:Props){
 const router=useRouter();const [valor,setValor]=useState(categoria||"automatico"),[ocupado,setOcupado]=useState(false),[mensagem,setMensagem]=useState("");
 const [prestadorId,setPrestadorId]=useState(vinculo ? String(vinculo.colaboradorId) : "");
 const [competencia,setCompetencia]=useState(vinculo?.competencia || competenciaInicial || "");
 const [destino,setDestino]=useState("");
 const [prestadorDestino,setPrestadorDestino]=useState("");
 const [mesDestino,setMesDestino]=useState(vinculo?.competencia || competenciaInicial || "");
 async function transferir() {
  setOcupado(true);
  setMensagem("");
  try {
   const resposta=await fetch("/api/admin/notas/transferir",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
     key:arquivoKey,associacaoOrigem:origem,associacaoDestino:destino,
     colaboradorId:compraMudas?undefined:Number(prestadorDestino),competencia:mesDestino,
    }),
   });
   const dados=await resposta.json() as {message?:string};
   if(!resposta.ok)throw Error(dados.message||"FALHA AO TRANSFERIR.");
   setMensagem(dados.message||"NOTA TRANSFERIDA.");
   const url=new URL(window.location.href);
   url.searchParams.set("associacaoDocumentos",destino);
   if(!url.searchParams.getAll("competencias").includes(mesDestino))url.searchParams.append("competencias",mesDestino);
   router.push(url.pathname+url.search);
   router.refresh();
  } catch(erro) {
   setMensagem(erro instanceof Error?erro.message:"FALHA DE CONEXÃO.");
   setOcupado(false);
  }
 }
 async function salvar(vinculoPrestacao?: VinculoNotaServico){setOcupado(true);setMensagem("");try{const resposta=await fetch("/api/admin/notas/classificar",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:arquivoKey,categoriaNota:vinculoPrestacao?"servico":valor,vinculoPrestacao})});const dados=await resposta.json() as {message?:string};if(!resposta.ok)throw Error(dados.message||"FALHA AO SALVAR.");if(vinculoPrestacao)setValor("servico");setMensagem(dados.message||"IDENTIFICAÇÃO ATUALIZADA.");router.refresh();}catch(erro){setMensagem(erro instanceof Error?erro.message:"FALHA DE CONEXÃO.");}finally{setOcupado(false);}}
 async function reler(){setOcupado(true);setMensagem("");try{const resposta=await fetch("/api/admin/documentos-associacao/processar",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:arquivoKey})});const dados=await resposta.json() as {message?:string};if(!resposta.ok)throw Error(dados.message||"FALHA NA LEITURA.");setMensagem(dados.message||"IDENTIFICAÇÃO ATUALIZADA.");router.refresh();}catch(erro){setMensagem(erro instanceof Error?erro.message:"FALHA DE CONEXÃO.");}finally{setOcupado(false);}}
 return <div className="mt-3 border-t pt-3"><label className="block text-xs font-black">IDENTIFICAR TIPO DA NOTA<select value={valor} disabled={ocupado} onChange={e=>{setValor(e.target.value);setMensagem("");}} className="mt-1 h-10 w-full rounded-lg border bg-white px-2"><option value="automatico">IDENTIFICAÇÃO AUTOMÁTICA</option><option value="mudas">NOTA DE COMPRA DE MUDAS</option><option value="servico">NOTA DE SERVIÇO</option><option value="outras">OUTRAS NOTAS</option></select></label><button type="button" disabled={ocupado} onClick={()=>void salvar()} className="mt-2 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-black text-white disabled:opacity-50">{ocupado?"SALVANDO...":"SALVAR IDENTIFICAÇÃO"}</button><button type="button" disabled={ocupado} onClick={()=>void reler()} className="ml-2 mt-2 rounded-lg border border-emerald-800 px-3 py-2 text-xs font-black text-emerald-900 disabled:opacity-50">RELER CONTEÚDO DO ARQUIVO</button>{prestadores&&<details className="mt-3 rounded-lg border bg-white p-3">
 <summary className="cursor-pointer text-xs font-black text-emerald-900">EDITAR PRESTADOR E COMPETÊNCIA</summary>
 <form className="mt-3 grid gap-3" onSubmit={evento=>{
  evento.preventDefault();
  void salvar({colaboradorId:Number(prestadorId),competencia});
 }}>
  <label className="text-xs font-black">PRESTADOR
   <select required disabled={ocupado} value={prestadorId} onChange={evento=>setPrestadorId(evento.target.value)} className="mt-1 h-10 w-full rounded-lg border px-2">
    <option value="">SELECIONE O COLABORADOR</option>
    {prestadores.map(pessoa=><option key={pessoa.id} value={pessoa.id}>{pessoa.nomeCompleto}</option>)}
   </select>
  </label>
  <label className="text-xs font-black">COMPETÊNCIA DA PRESTAÇÃO DE CONTAS
   <input type="month" required min="2000-01" max="2099-12" disabled={ocupado} value={competencia} onChange={evento=>setCompetencia(evento.target.value)} className="mt-1 h-10 w-full rounded-lg border px-2"/>
  </label>
  <button type="submit" disabled={ocupado||!prestadorId||!competencia} className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-black text-white disabled:opacity-50">SALVAR PRESTADOR E COMPETÊNCIA</button>
 </form>
 </details>}{destinos&&<details className="mt-3 rounded-lg border bg-white p-3">
 <summary className="cursor-pointer text-xs font-black text-emerald-900">TRANSFERIR PARA OUTRA ASSOCIAÇÃO</summary>
 <form className="mt-3 grid gap-3" onSubmit={evento=>{
  evento.preventDefault();
  void transferir();
 }}>
  <label className="text-xs font-black">ASSOCIAÇÃO DE DESTINO
   <select required disabled={ocupado} value={destino} onChange={evento=>{setDestino(evento.target.value);setPrestadorDestino("");}} className="mt-1 h-10 w-full rounded-lg border px-2">
    <option value="">SELECIONE A ASSOCIAÇÃO</option>
    {Object.keys(destinos).filter(nome=>nome!==origem).map(nome=><option key={nome} value={nome}>{nome}</option>)}
   </select>
  </label>
  {!compraMudas&&<label className="text-xs font-black">PRESTADOR NO DESTINO
   <select required disabled={ocupado||!destino} value={prestadorDestino} onChange={evento=>setPrestadorDestino(evento.target.value)} className="mt-1 h-10 w-full rounded-lg border px-2">
    <option value="">SELECIONE O COLABORADOR</option>
    {(destinos[destino]||[]).map(pessoa=><option key={pessoa.id} value={pessoa.id}>{pessoa.nomeCompleto}</option>)}
   </select>
  </label>}
  <label className="text-xs font-black">COMPETÊNCIA NO DESTINO
   <input type="month" required min="2000-01" max="2099-12" disabled={ocupado} value={mesDestino} onChange={evento=>setMesDestino(evento.target.value)} className="mt-1 h-10 w-full rounded-lg border px-2"/>
  </label>
  <button type="submit" disabled={ocupado||!destino||(!compraMudas&&!prestadorDestino)||!mesDestino} className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-black text-white disabled:opacity-50">TRANSFERIR NOTA</button>
 </form>
 </details>}{mensagem&&<p role="status" className="mt-2 text-xs font-bold">{mensagem}</p>}</div>;
}
