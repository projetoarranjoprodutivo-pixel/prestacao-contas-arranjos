"use client";

import { useState } from "react";
import { strFromU8, unzipSync } from "fflate";

type Dados = { relatorios?: Array<{ competencia?: string; arquivo?: string }> };
type Resultado = { message?: string; tecnico?: string; competencias?: string[]; atividades?: number };

function nomeBase(caminho: string) { return caminho.split("/").pop() || caminho; }
async function enviarImportacao(texto: string, arquivos: Map<string, File>) {
  const dados = JSON.parse(texto) as Dados;
  if (!dados.relatorios?.length) throw new Error("O JSON NÃO POSSUI RELATÓRIOS.");
  const envio = new FormData();
  envio.set("dados", texto);
  for (const relatorio of dados.relatorios) {
    const arquivo = relatorio.arquivo ? arquivos.get(relatorio.arquivo) : undefined;
    if (!relatorio.competencia || !arquivo) throw new Error(`PDF NÃO ENCONTRADO PARA ${relatorio.competencia || "COMPETÊNCIA INVÁLIDA"}.`);
    envio.set(`relatorio-${relatorio.competencia}`, arquivo);
  }
  const resposta = await fetch("/api/admin/importar-relatorios-historicos", { method: "POST", body: envio });
  const corpo = await resposta.json().catch(() => ({})) as Resultado;
  if (!resposta.ok) throw new Error(corpo.message || "NÃO FOI POSSÍVEL IMPORTAR.");
  return corpo;
}

export default function ImportadorRelatorios() {
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [pacoteZip, setPacoteZip] = useState<File | null>(null);
  const [dadosArquivo, setDadosArquivo] = useState<File | null>(null);
  const [pdfsArquivos, setPdfsArquivos] = useState<File[]>([]);

  async function enviarZip(arquivo: File) {
    const conteudo = unzipSync(new Uint8Array(await arquivo.arrayBuffer()));
    const entradas = Object.entries(conteudo).filter(([caminho]) => !caminho.endsWith("/") && !caminho.startsWith("__MACOSX/"));
    const jsons = entradas.filter(([caminho]) => caminho.toLowerCase().endsWith(".json"));
    const pdfs = new Map<string, File>();
    for (const [caminho, bytes] of entradas.filter(([nome]) => nome.toLowerCase().endsWith(".pdf"))) {
      const nome = nomeBase(caminho);
      pdfs.set(nome, new File([bytes.slice().buffer], nome, { type: "application/pdf" }));
    }
    if (!jsons.length) throw new Error("O ZIP NÃO POSSUI ARQUIVOS JSON.");
    if (!pdfs.size) throw new Error("O ZIP NÃO POSSUI ARQUIVOS PDF.");

    const resultados: string[] = [];
    for (const [caminho, bytes] of jsons) {
      setMensagem(`IMPORTANDO ${nomeBase(caminho)}... ${resultados.length}/${jsons.length} CONCLUÍDOS.`);
      try {
        const corpo = await enviarImportacao(strFromU8(bytes), pdfs);
        resultados.push(`✓ ${corpo.tecnico || nomeBase(caminho)} · ${corpo.competencias?.join(", ") || "COMPETÊNCIA IMPORTADA"} · ${corpo.atividades || 0} ATIVIDADES`);
      } catch (erro) {
        const detalhe = erro instanceof Error ? erro.message : "NÃO FOI POSSÍVEL IMPORTAR.";
        resultados.push(`✗ ${nomeBase(caminho)} · ${detalhe}`);
      }
    }
    setMensagem(`IMPORTAÇÃO DO PACOTE CONCLUÍDA.\n${resultados.join("\n")}`);
  }

  async function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnviando(true);
    setMensagem("");
    try {
      if (pacoteZip) { await enviarZip(pacoteZip); return; }
      if (!dadosArquivo) throw new Error("SELECIONE O ARQUIVO JSON.");
      const texto = await dadosArquivo.text();
      const porNome = new Map(pdfsArquivos.map((item) => [item.name, item]));
      const corpo = await enviarImportacao(texto, porNome);
      setMensagem(`${corpo.message} ${corpo.tecnico} · ${corpo.competencias?.join(", ")} · ${corpo.atividades} ATIVIDADES.`);
    } catch (erro) {
      setMensagem(erro instanceof Error ? erro.message : "NÃO FOI POSSÍVEL IMPORTAR.");
    } finally { setEnviando(false); }
  }

  return (
    <form onSubmit={enviar} className="mt-6 space-y-5">
      <section className="rounded-2xl border-2 border-emerald-700 bg-emerald-50 p-5">
        <h2 className="text-lg font-black text-emerald-950">IMPORTAR PACOTE COMPLETO</h2>
        <p className="mt-1 text-sm font-semibold text-emerald-900">ENVIE UM ÚNICO ZIP COM TODOS OS ARQUIVOS JSON E PDF. O SISTEMA FARÁ AS IMPORTAÇÕES EM SEQUÊNCIA.</p>
        <label className="mt-4 block text-sm font-black">ARQUIVO ZIP
          <input className="mt-2 block w-full rounded-xl border border-emerald-300 bg-white p-3" type="file" name="pacoteZip" accept="application/zip,.zip" onChange={async(event)=>{const arquivo=event.target.files?.[0];setPacoteZip(arquivo?new File([await arquivo.arrayBuffer()],arquivo.name,{type:arquivo.type}):null)}} />
        </label>
      </section>
      <div className="flex items-center gap-3 text-xs font-black text-slate-500"><span className="h-px flex-1 bg-slate-300"/><span>OU IMPORTE UM RELATÓRIO INDIVIDUAL</span><span className="h-px flex-1 bg-slate-300"/></div>
      <label className="block text-sm font-black">ARQUIVO JSON
        <input className="mt-2 block w-full rounded-xl border border-slate-300 p-3" type="file" name="dadosArquivo" accept="application/json,.json" onChange={async(event)=>{const arquivo=event.target.files?.[0];setDadosArquivo(arquivo?new File([await arquivo.arrayBuffer()],arquivo.name,{type:arquivo.type}):null)}} />
      </label>
      <label className="block text-sm font-black">PDFS DE FOTOS E LISTAS
        <input className="mt-2 block w-full rounded-xl border border-slate-300 p-3" type="file" name="pdfs" accept="application/pdf,.pdf" multiple onChange={async(event)=>{const arquivos=Array.from(event.target.files||[]);setPdfsArquivos(await Promise.all(arquivos.map(async arquivo=>new File([await arquivo.arrayBuffer()],arquivo.name,{type:arquivo.type}))))}} />
      </label>
      <button disabled={enviando} className="h-12 rounded-xl bg-emerald-700 px-6 font-black text-white disabled:opacity-50">{enviando ? "IMPORTANDO..." : "IMPORTAR RELATÓRIOS"}</button>
      {mensagem && <p className="whitespace-pre-line rounded-xl bg-slate-100 p-4 text-sm font-bold" role="status">{mensagem}</p>}
    </form>
  );
}
