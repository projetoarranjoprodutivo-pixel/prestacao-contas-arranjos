"use client";

import { useState } from "react";

type Lote = { examinados: number; relatorios: number; atividades: number; conflitos: number; ambiguas: number; candidatos: number; proximo: number | null; message?: string };

export default function PadronizarDuracoes() {
 const [ocupado,setOcupado]=useState(false);
 const [mensagem,setMensagem]=useState("");
 async function verificar(somenteConferir: boolean) {
  setOcupado(true);
  let cursor: number | null = 0, examinados = 0, relatorios = 0, atividades = 0, conflitos = 0, ambiguas = 0, candidatos = 0;
  try {
   while (cursor !== null) {
    setMensagem(`${examinados} RELATÓRIO(S) VERIFICADO(S)…`);
    const resposta = await fetch("/api/admin/relatorios/duracoes", {
     method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cursor, somenteConferir }),
    });
    const lote = await resposta.json() as Lote;
    if (!resposta.ok) throw new Error(lote.message || "FALHA NA VARREDURA.");
    examinados += lote.examinados;
    relatorios += lote.relatorios;
    atividades += lote.atividades;
    conflitos += lote.conflitos;
    ambiguas += lote.ambiguas;
    candidatos += lote.candidatos;
    cursor = lote.proximo;
   }
   const resultado = somenteConferir ? `${candidatos} ATIVIDADE(S) COM UNIDADE CONFIRMADA OU DURAÇÃO EM BRANCO.` :
    `${atividades} ATIVIDADE(S) ATUALIZADA(S) EM ${relatorios} RELATÓRIO(S).`;
   setMensagem(`${examinados} RELATÓRIO(S) VERIFICADO(S). ${resultado} ${ambiguas} DURAÇÃO(ÕES) SEM UNIDADE CONFIRMADA.${conflitos ? ` ${conflitos} CONFLITO(S). EXECUTE NOVAMENTE PARA CONFERIR.` : ""}`);
  } catch (erro) {
   setMensagem(erro instanceof Error ? erro.message : "FALHA NA VARREDURA.");
  } finally {
   setOcupado(false);
  }
 }
 return <section className="mt-8 border-t pt-4">
  <h2 className="font-bold">CONFERÊNCIA DE DURAÇÕES</h2>
  <p className="mt-1 text-sm text-slate-600">Confira os relatórios salvos e corrija as unidades confirmadas pelo plano importado e aplique 3 horas às atividades datadas sem duração.</p>
  <button type="button" disabled={ocupado} onClick={()=>void verificar(false)} className="mt-3 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">CORRIGIR DURAÇÕES</button>
  <button type="button" disabled={ocupado} onClick={()=>void verificar(true)} className="ml-2 mt-3 rounded-lg border px-4 py-2 text-sm font-bold disabled:opacity-50">CONFERIR DURAÇÕES</button>
  {mensagem&&<p role="status" className="mt-3 text-sm font-semibold">{mensagem}</p>}
 </section>;
}
