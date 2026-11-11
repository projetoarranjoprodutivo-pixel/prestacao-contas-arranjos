"use client";

import { useState } from "react";
import { formatarMoeda } from "@/lib/moeda";

export default function OrcamentoMudas({ associacoes }: { associacoes: { id: number; nome: string }[] }) {
  const [associacao, selecionar] = useState("");
  const [valor, definirValor] = useState("");
  const [ocupado, definirOcupado] = useState(false);
  const [carregado, definirCarregado] = useState(false);
  const [mensagem, definirMensagem] = useState("");

  async function carregar(id: string) {
    selecionar(id);
    definirValor("");
    definirMensagem("");
    definirCarregado(false);
    if (!id) return;
    definirOcupado(true);
    try {
      const resposta = await fetch(`/api/admin/orcamento-mudas?associacaoId=${encodeURIComponent(id)}`, { cache: "no-store" });
      const dados = await resposta.json() as { valor?: number | null; message?: string };
      if (!resposta.ok) throw new Error(dados.message || "Falha ao consultar.");
      definirValor(formatarMoeda(dados.valor, ""));
      definirCarregado(true);
    } catch (erro) {
      definirMensagem(erro instanceof Error ? erro.message : "Falha ao consultar.");
    } finally {
      definirOcupado(false);
    }
  }

  async function salvar() {
    definirOcupado(true);
    definirMensagem("");
    try {
      const resposta = await fetch("/api/admin/orcamento-mudas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ associacaoId: Number(associacao), valor }),
      });
      const dados = await resposta.json() as { message?: string };
      if (!resposta.ok) throw new Error(dados.message || "Falha ao salvar.");
      definirValor(formatarMoeda(valor));
      definirMensagem(dados.message || "Valor salvo.");
    } catch (erro) {
      definirMensagem(erro instanceof Error ? erro.message : "Falha ao salvar.");
    } finally {
      definirOcupado(false);
    }
  }

  return <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
    <h2 className="text-lg font-black">VALOR DISPONIBILIZADO PARA INSUMOS E MUDAS</h2>
    <p className="mt-1 text-sm text-slate-600">Meta pactuada da prestação ADERES.</p>
    <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={evento => { evento.preventDefault(); void salvar(); }}>
      <label className="grid gap-1 text-xs font-bold">ASSOCIAÇÃO
        <select className="h-10 rounded-lg border bg-white px-3" value={associacao} disabled={ocupado}
          onChange={evento => void carregar(evento.target.value)}>
          <option value="">SELECIONE A ASSOCIAÇÃO</option>
          {associacoes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-bold">VALOR DISPONIBILIZADO EM REAIS
        <input className="h-10 rounded-lg border px-3" inputMode="decimal" placeholder="R$ 0,00"
          value={valor} onChange={evento => definirValor(evento.target.value)} required disabled={!carregado || ocupado}/>
      </label>
      <button className="h-10 rounded-lg bg-emerald-800 px-4 text-xs font-black text-white disabled:opacity-50"
        disabled={!carregado || ocupado || !valor.trim()}>SALVAR VALOR</button>
    </form>
    {mensagem && <p role="status" className="mt-2 text-sm font-bold">{mensagem}</p>}
  </section>;
}
