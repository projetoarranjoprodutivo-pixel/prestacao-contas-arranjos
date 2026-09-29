"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Plus, X } from "lucide-react";
import { PDFDocument } from "pdf-lib";

type Props = {
  associacoes: string[];
  competenciaInicial: string;
  competenciasDisponiveis?: string[];
  compacto?: boolean;
};

function rotuloCompetencia(valor: string) {
  if (!/^\d{4}-\d{2}$/.test(valor)) return valor;
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${valor}-02T12:00:00Z`));
}

export default function AderesPdfForm({
  associacoes,
  competenciaInicial,
  competenciasDisponiveis = [],
  compacto = false,
}: Props) {
  const [competencias, setCompetencias] = useState<string[]>([competenciaInicial]);
  const [novaCompetencia, setNovaCompetencia] = useState("");
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function gerarPdfComAnexos() {
    const formulario=formRef.current;if(!formulario||gerandoPdf)return;
    const associacao=String(new FormData(formulario).get("associacao")||"");
    if(!associacao){alert("SELECIONE A ASSOCIAÇÃO.");return;}
    setGerandoPdf(true);
    try{
      const destino=await PDFDocument.create();
      for(const competencia of competencias){
        const resposta=await fetch(`/api/admin/prestacao-associacao/pdf?competencias=${encodeURIComponent(competencia)}&associacao=${encodeURIComponent(associacao)}`);
        if(!resposta.ok)throw new Error(`NÃO FOI POSSÍVEL GERAR A COMPETÊNCIA ${competencia}.`);
        const origem=await PDFDocument.load(await resposta.arrayBuffer());
        const paginas=await destino.copyPages(origem,origem.getPageIndices());paginas.forEach(pagina=>destino.addPage(pagina));
      }
      const bytes=await destino.save();
      const blob=new Blob([bytes],{type:"application/pdf"});const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=`prestacao-aderes-${associacao.replace(/[^a-zA-Z0-9_-]/g,"-")}-${competencias.join("_")}.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
    }catch(error){alert(error instanceof Error?error.message:"NÃO FOI POSSÍVEL GERAR O PDF.");}finally{setGerandoPdf(false);}
  }

  function adicionar() {
    if (!/^\d{4}-\d{2}$/.test(novaCompetencia)) return;
    setCompetencias((atuais) =>
      [...new Set([...atuais, novaCompetencia])].sort()
    );
    setNovaCompetencia("");
  }

  function remover(valor: string) {
    setCompetencias((atuais) =>
      atuais.length > 1 ? atuais.filter((item) => item !== valor) : atuais
    );
  }

  return (
    <form
      ref={formRef}
      action="/api/admin/prestacao-associacao/pdf"
      method="get"
      target="_blank"
      className={compacto ? "grid w-full gap-3 rounded-xl bg-emerald-50 p-4" : "mt-4 grid gap-4"}
    >
      <div>
        <p className="mb-2 text-sm font-bold">COMPETÊNCIAS SELECIONADAS</p>
        <div className="flex min-h-11 flex-wrap gap-2 rounded-lg border bg-white p-2">
          {competencias.map((item) => (
            <span key={item} className="inline-flex items-center gap-2 rounded-lg bg-emerald-100 px-3 py-2 text-sm font-bold text-emerald-950">
              {rotuloCompetencia(item)}
              <button type="button" onClick={() => remover(item)} title="REMOVER MÊS" className="rounded p-0.5 hover:bg-emerald-200">
                <X className="h-4 w-4" />
              </button>
              <input type="hidden" name="competencias" value={item} />
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[12rem_auto_1fr]">
        <input
          type="month"
          value={novaCompetencia}
          onChange={(event) => setNovaCompetencia(event.target.value)}
          list="competencias-aderes"
          className="h-11 rounded-lg border bg-white px-3"
          aria-label="ADICIONAR COMPETÊNCIA"
        />
        <datalist id="competencias-aderes">
          {competenciasDisponiveis.map((item) => <option key={item} value={item} />)}
        </datalist>
        <button type="button" onClick={adicionar} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-emerald-700 px-4 text-sm font-bold text-emerald-800">
          <Plus className="h-4 w-4" /> ADICIONAR MÊS
        </button>
        <select name="associacao" required className="h-11 rounded-lg border bg-white px-3">
          <option value="">SELECIONE A ASSOCIAÇÃO</option>
          {associacoes.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
        </select>
      </div>

      <div className="grid gap-2 lg:grid-cols-3">
        <button type="button" onClick={gerarPdfComAnexos} disabled={gerandoPdf} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
          <Download className="h-4 w-4" /> {gerandoPdf?"GERANDO PDF COM ANEXOS...":"GERAR PRESTAÇÃO ADERES EM PDF"}
        </button>
        <button formAction="/api/admin/prestacao-associacao/excel" name="modelo" value="agricultura" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 py-2 text-sm font-bold text-white">
          <FileSpreadsheet className="h-4 w-4" /> PLANILHA AGRICULTURA FAMILIAR
        </button>
        <button formAction="/api/admin/prestacao-associacao/excel" name="modelo" value="horas" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-bold text-white">
          <FileSpreadsheet className="h-4 w-4" /> PLANILHA CONTROLE DE HORAS
        </button>
      </div>
    </form>
  );
}
