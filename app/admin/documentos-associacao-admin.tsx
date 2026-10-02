"use client";

import { useState } from "react";
import DocumentosAssociacaoForm from "../portal-associacao/documentos-form";

export default function DocumentosAssociacaoAdmin({ associacoes }: { associacoes: string[] }) {
  const [associacao, setAssociacao] = useState("");

  return <section className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
    <p className="text-sm font-bold text-emerald-800">INCLUSÃO DE DOCUMENTOS</p>
    <h2 className="mt-1 text-xl font-bold">ENVIAR EXTRATO BANCÁRIO OU NOTA FISCAL</h2>
    <label className="mt-4 block text-sm font-bold">ASSOCIAÇÃO
      <select value={associacao} onChange={event => setAssociacao(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-4">
        <option value="">SELECIONE A ASSOCIAÇÃO</option>
        {associacoes.map(nome => <option key={nome} value={nome}>{nome}</option>)}
      </select>
    </label>
    {associacao && <div className="mt-5"><DocumentosAssociacaoForm associacao={associacao}/></div>}
  </section>;
}
