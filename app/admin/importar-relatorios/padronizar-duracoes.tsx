"use client";

import { useState } from "react";

type Lote = { examinados: number; relatorios: number; atividades: number; conflitos: number; proximo: number | null; message?: string };

export default function PadronizarDuracoes() {
 const [ocupado,setOcupado]=useState(false);
 const [mensagem,setMensagem]=useState("");
 async function verificar() {
  setOcupado(true);
  let cursor: number | null = 0, examinados = 0, relatorios = 0, atividades = 0, conflitos = 0;
  try {
   while (cursor !== null) {
    setMensagem(`${examinados} RELATÓRIO(S) VERIFICADO(S)…`);
    const resposta = await fetch("/api/admin/relatorios/duracoes", {
     method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cursor }),
    });
    const lote = await resposta.json() as Lote;
    if (!resposta.ok) throw new Error(lote.message || "FALHA NA VARREDURA.");
    examinados += lote.examinados;
    relatorios += lote.relatorios;
    atividades += lote.atividades;
    conflitos += lote.conflitos;
    cursor = lote.proximo;
   }
   setMensagem(`${examinados} RELATÓRIO(S) VERIFICADO(S). ${atividades} ATIVIDADE(S) ATUALIZADA(S) EM ${relatorios} RELATÓRIO(S).${conflitos ? ` ${conflitos} CONFLITO(S). EXECUTE NOVAMENTE PARA CONFERIR.` : ""}`);
  } catch (erro) {
   setMensagem(erro instanceof Error ? erro.message : "FALHA NA VARREDURA.");
  } finally {
   setOcupado(false);
  }
 }
 return <section className="mt-8 border-t pt-4">
  <h2 className="font-bold">DURAÇÕES EM BRANCO</h2>
  <p className="mt-1 text-sm text-slate-600">Aplique 3 horas às atividades datadas e executadas sem duração nas prestações já salvas.</p>
  <button type="button" disabled={ocupado} onClick={()=>void verificar()} className="mt-3 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">PADRONIZAR DURAÇÕES DOS RELATÓRIOS</button>
  {mensagem&&<p role="status" className="mt-3 text-sm font-semibold">{mensagem}</p>}
 </section>;
}
