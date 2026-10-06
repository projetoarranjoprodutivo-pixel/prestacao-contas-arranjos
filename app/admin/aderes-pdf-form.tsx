"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";

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
  compacto = false,
}: Props) {
  const [competencias, setCompetencias] = useState<string[]>([competenciaInicial]);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const selecionadas = new URLSearchParams(window.location.search).getAll("competencias").filter(item => /^\d{4}-\d{2}$/.test(item));
    if (selecionadas.length) setCompetencias([...new Set(selecionadas)].sort());
  }, [competenciaInicial]);

  async function gerarPdfComAnexos() {
    const formulario=formRef.current;if(!formulario||gerandoPdf)return;
    const associacao=String(new FormData(formulario).get("associacao")||"");
    if(!associacao){alert("SELECIONE A ASSOCIAÇÃO.");return;}
    if(!competencias.length){alert("SELECIONE AO MENOS UMA COMPETÊNCIA.");return;}
    setGerandoPdf(true);
    try{
      const parametros=new URLSearchParams({associacao});competencias.forEach(competencia=>parametros.append("competencias",competencia));
      const resposta=await fetch(`/api/admin/prestacao-associacao/pdf?${parametros.toString()}`);
      if(!resposta.ok){const detalhe=await resposta.text().catch(()=>"");throw new Error(detalhe||"NÃO FOI POSSÍVEL GERAR O RELATÓRIO GERAL ADERES.");}
      const blob=await resposta.blob();const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=`prestacao-aderes-${associacao.replace(/[^a-zA-Z0-9_-]/g,"-")}-${competencias.join("_")}.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
    }catch(error){alert(error instanceof Error?error.message:"NÃO FOI POSSÍVEL GERAR O PDF.");}finally{setGerandoPdf(false);}
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
        <p className="mb-2 text-sm font-bold">COMPETÊNCIAS DEFINIDAS NO FILTRO GERAL</p>
        <div className="flex min-h-11 flex-wrap gap-2 rounded-lg border bg-white p-2">
          {competencias.map((item) => (
            <span key={item} className="inline-flex items-center gap-2 rounded-lg bg-emerald-100 px-3 py-2 text-sm font-bold text-emerald-950">
              {rotuloCompetencia(item)}
              <input type="hidden" name="competencias" value={item} />
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
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
