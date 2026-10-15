"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, ReceiptText, UploadCloud } from "lucide-react";

type Nota = { arquivo: File; descricao: string; quantidade: string; valor: string; dataEmissao: string; competencia: string; leitura: "lendo"|"concluida"|"erro"; erro?: string };
const campo = "mt-1.5 h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base";

export default function NotaFiscalForm({ associacao }: { associacao: string }) {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);

  function alterar(indice: number, dados: Partial<Nota>) { setNotas(atuais => atuais.map((nota, i) => i === indice ? { ...nota, ...dados } : nota)); }

  async function ler(arquivo: File, indice: number) {
    const form = new FormData(); form.append("arquivo", arquivo);
    try {
      const resposta = await fetch("/api/associacao/documentos/ler", { method: "POST", body: form });
      const dados = await resposta.json().catch(() => ({})) as Record<string, string>;
      if (!resposta.ok) throw new Error(dados.message || "NÃO FOI POSSÍVEL LER A NOTA FISCAL.");
      alterar(indice, { descricao: dados.descricao || "", quantidade: dados.quantidade || "", valor: dados.valor || "", dataEmissao: dados.dataEmissao || "", competencia: dados.competencia || (dados.dataEmissao || "").slice(0, 7), leitura: "concluida", erro: "" });
    } catch (erro) { alterar(indice, { leitura: "erro", erro: erro instanceof Error ? erro.message : "NÃO FOI POSSÍVEL LER A NOTA FISCAL." }); }
  }

  function selecionar(arquivos: File[]) {
    const inicio = notas.length;
    setNotas(atuais => [...atuais, ...arquivos.map(arquivo => ({ arquivo, descricao: "", quantidade: "", valor: "", dataEmissao: "", competencia: "", leitura: "lendo" as const }))]);
    arquivos.forEach((arquivo, posicao) => void ler(arquivo, inicio + posicao));
  }

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!notas.length) return setMensagem("SELECIONE PELO MENOS UMA NOTA FISCAL.");
    if (notas.some(nota => nota.leitura === "lendo")) return setMensagem("AGUARDE A LEITURA DAS NOTAS.");
    if (notas.some(nota => !nota.descricao || !nota.valor || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(nota.competencia))) return setMensagem("CONFIRA A DESCRIÇÃO, O VALOR E A COMPETÊNCIA DE TODAS AS NOTAS.");
    setEnviando(true); setMensagem("");
    const form = new FormData(); form.set("associacao", associacao);
    notas.forEach(nota => form.append("notasFiscais", nota.arquivo));
    form.set("dadosNotas", JSON.stringify(notas.map(nota => ({ descricao: nota.descricao, quantidade: nota.quantidade, valor: nota.valor, dataEmissao: nota.dataEmissao, competencia: nota.competencia, associacao }))));
    const resposta = await fetch("/api/associacao/documentos", { method: "POST", body: form });
    const dados = await resposta.json().catch(() => ({})) as { message?: string };
    setMensagem(dados.message || "NÃO FOI POSSÍVEL ENVIAR."); setEnviando(false);
    if (resposta.ok) setNotas([]);
  }

  return <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
    <p className="text-sm font-black text-violet-700">DOCUMENTO FINANCEIRO</p><h1 className="mt-1 text-3xl font-black">ENVIAR NOTA FISCAL</h1>
    <p className="mt-2 text-slate-600">A NOTA SERÁ LIDA AUTOMATICAMENTE E FICARÁ DISPONÍVEL PARA <strong>{associacao}</strong> E PARA A ADERES.</p>
    <form onSubmit={enviar} className="mt-6">
      <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-violet-300 bg-violet-50 p-5 text-center"><UploadCloud className="h-8 w-8 text-violet-800"/><span className="mt-2 font-black">SELECIONAR NOTA FISCAL</span><span className="text-xs text-slate-600">PDF, JPG OU PNG — ATÉ 10 MB POR ARQUIVO</span><input className="sr-only" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" onChange={e => { selecionar(Array.from(e.target.files || [])); e.target.value = ""; }}/></label>
      <div className="mt-5 space-y-4">{notas.map((nota, indice) => <article key={`${nota.arquivo.name}-${indice}`} className="rounded-xl border bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3"><span className="truncate font-black">{nota.arquivo.name}</span><button type="button" onClick={() => setNotas(atuais => atuais.filter((_, i) => i !== indice))} className="text-sm font-black text-red-700">REMOVER</button></div>
        {nota.leitura === "lendo" && <p className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm font-bold text-blue-900"><Loader2 className="h-4 w-4 animate-spin"/>LENDO A NOTA FISCAL...</p>}
        {nota.leitura === "concluida" && <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-900"><CheckCircle2 className="h-4 w-4"/>LEITURA CONCLUÍDA. CONFIRA OS DADOS.</p>}
        {nota.leitura === "erro" && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-900">{nota.erro} PREENCHA OS CAMPOS MANUALMENTE.</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-black sm:col-span-2">DESCRIÇÃO DO PRODUTO OU SERVIÇO<input className={campo} value={nota.descricao} onChange={e => alterar(indice, { descricao: e.target.value })}/></label><label className="text-xs font-black">QUANTIDADE<input className={campo} value={nota.quantidade} onChange={e => alterar(indice, { quantidade: e.target.value })}/></label><label className="text-xs font-black">VALOR TOTAL (R$)<input className={campo} type="number" min="0" step="0.01" value={nota.valor} onChange={e => alterar(indice, { valor: e.target.value })}/></label><label className="text-xs font-black">DATA DE EMISSÃO<input className={campo} type="date" value={nota.dataEmissao} onChange={e => alterar(indice, { dataEmissao: e.target.value, competencia: e.target.value ? e.target.value.slice(0, 7) : nota.competencia })}/></label><label className="text-xs font-black">COMPETÊNCIA<input className={campo} type="month" value={nota.competencia} onChange={e => alterar(indice, { competencia: e.target.value })}/></label></div>
      </article>)}</div>
      <button disabled={enviando || !notas.length} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-800 px-5 font-black text-white disabled:opacity-50">{enviando && <Loader2 className="h-4 w-4 animate-spin"/>}ENVIAR NOTA FISCAL</button>
      {mensagem && <p className="mt-4 rounded-lg bg-slate-100 p-3 text-sm font-black">{mensagem}</p>}
    </form>
  </section>;
}
