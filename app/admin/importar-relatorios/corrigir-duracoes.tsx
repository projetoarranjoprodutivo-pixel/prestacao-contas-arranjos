"use client";

import { useState, type FormEvent } from "react";

export default function CorrigirDuracoes({ pessoas }: { pessoas: { id: number; nomeCompleto: string; associacao: string | null }[] }) {
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    setOcupado(true);
    setMensagem("");
    try {
      const resposta = await fetch("/api/admin/relatorios/duracoes/corrigir", { method: "POST", body: dados });
      const resultado = await resposta.json() as { message?: string };
      setMensagem(resultado.message || "Não foi possível concluir a correção.");
    } catch {
      setMensagem("Não foi possível concluir a correção. Confira a conexão.");
    } finally {
      setOcupado(false);
    }
  }

  return <details className="mt-6 border-t pt-4">
    <summary className="cursor-pointer font-bold">Corrigir durações de uma prestação</summary>
    <form onSubmit={salvar} className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-sm font-bold">Colaborador
        <select className="rounded-lg border bg-white p-2" name="colaboradorId" required defaultValue="">
          <option value="" disabled>Selecione</option>
          {pessoas.map(pessoa => <option key={pessoa.id} value={pessoa.id}>{pessoa.nomeCompleto} · {pessoa.associacao || "Sem associação"}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-bold">Competência
        <input className="rounded-lg border p-2" type="month" name="competencia" required/>
      </label>
      <label className="grid gap-1 text-sm font-bold sm:col-span-2">Datas e durações
        <textarea className="rounded-lg border p-2 font-mono" name="duracoes" required rows={6} maxLength={12000} placeholder="2026-04-06 10:00"/>
        <span className="font-normal">Informe uma linha por atividade executada, com data AAAA-MM-DD e duração H:MM. Use esta correção quando houver uma atividade por data.</span>
      </label>
      <button disabled={ocupado} className="justify-self-start rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Salvar durações da prestação</button>
      {mensagem && <p role="status" className="sm:col-span-2 text-sm font-semibold">{mensagem}</p>}
    </form>
  </details>;
}
