"use client";

import { useState } from "react";

type Dados = { relatorios?: Array<{ competencia?: string; arquivo?: string }> };

export default function ImportadorRelatorios() {
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnviando(true);
    setMensagem("");
    try {
      const form = new FormData(event.currentTarget);
      const json = form.get("dadosArquivo");
      const pdfs = form.getAll("pdfs");
      if (!(json instanceof File) || !json.size) throw new Error("SELECIONE O ARQUIVO JSON.");
      const texto = await json.text();
      const dados = JSON.parse(texto) as Dados;
      if (!dados.relatorios?.length) throw new Error("O JSON NÃO POSSUI RELATÓRIOS.");
      const porNome = new Map(pdfs.filter((item): item is File => item instanceof File && item.size > 0).map((item) => [item.name, item]));
      const envio = new FormData();
      envio.set("dados", texto);
      for (const relatorio of dados.relatorios) {
        const arquivo = relatorio.arquivo ? porNome.get(relatorio.arquivo) : undefined;
        if (!relatorio.competencia || !arquivo) throw new Error(`PDF NÃO ENCONTRADO PARA ${relatorio.competencia || "COMPETÊNCIA INVÁLIDA"}.`);
        envio.set(`relatorio-${relatorio.competencia}`, arquivo);
      }
      const resposta = await fetch("/api/admin/importar-relatorios-historicos", { method: "POST", body: envio });
      const corpo = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(corpo.message || "NÃO FOI POSSÍVEL IMPORTAR.");
      setMensagem(`${corpo.message} ${corpo.tecnico} · ${corpo.competencias?.join(", ")} · ${corpo.atividades} ATIVIDADES.`);
    } catch (erro) {
      setMensagem(erro instanceof Error ? erro.message : "NÃO FOI POSSÍVEL IMPORTAR.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="mt-6 space-y-5">
      <label className="block text-sm font-black">ARQUIVO JSON
        <input className="mt-2 block w-full rounded-xl border border-slate-300 p-3" type="file" name="dadosArquivo" accept="application/json,.json" required />
      </label>
      <label className="block text-sm font-black">PDFS DE FOTOS E LISTAS
        <input className="mt-2 block w-full rounded-xl border border-slate-300 p-3" type="file" name="pdfs" accept="application/pdf,.pdf" multiple required />
      </label>
      <button disabled={enviando} className="h-12 rounded-xl bg-emerald-700 px-6 font-black text-white disabled:opacity-50">
        {enviando ? "IMPORTANDO..." : "IMPORTAR RELATÓRIOS"}
      </button>
      {mensagem && <p className="rounded-xl bg-slate-100 p-4 text-sm font-bold" role="status">{mensagem}</p>}
    </form>
  );
}
