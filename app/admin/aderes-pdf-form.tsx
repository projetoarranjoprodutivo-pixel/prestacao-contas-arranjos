"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

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

type ArquivoRelatorio={key:string;nome:string;tipo:string;grupo:string};
type RelatorioJson={titulo:string;sections:Array<{heading:string;lines:string[]}>;arquivos?:ArquivoRelatorio[]};

function quebrarTexto(texto:string,fonte:PDFFont,tamanho:number,largura:number){
  const semPrivados=String(texto||"").replace(/[\uE000-\uF8FF\uFFFD]/g," ");
  const seguro=Array.from(semPrivados).filter(caractere=>{try{fonte.encodeText(caractere);return true;}catch{return false;}}).join("");
  const palavras=seguro.replace(/\s+/g," ").trim().split(" ");const linhas:string[]=[];let atual="";
  for(const palavra of palavras){const teste=atual?`${atual} ${palavra}`:palavra;if(fonte.widthOfTextAtSize(teste,tamanho)<=largura)atual=teste;else{if(atual)linhas.push(atual);atual=palavra;}}
  if(atual)linhas.push(atual);return linhas.length?linhas:[""];
}

async function adicionarRelatorio(pdf:PDFDocument,relatorio:RelatorioJson){
  const normal=await pdf.embedFont(StandardFonts.Helvetica);const negrito=await pdf.embedFont(StandardFonts.HelveticaBold);let pagina:PDFPage;let y=0;
  const novaPagina=()=>{pagina=pdf.addPage([595.28,841.89]);pagina.drawRectangle({x:0,y:763,width:595.28,height:78,color:rgb(0.02,0.28,0.19)});const titulo=quebrarTexto(relatorio.titulo,negrito,12,511).slice(0,3);titulo.forEach((linha,i)=>pagina.drawText(linha,{x:42,y:814-i*15,size:12,font:negrito,color:rgb(1,1,1)}));y=738;};
  const garantir=(altura:number)=>{if(y-altura<45)novaPagina();};novaPagina();
  for(const secao of relatorio.sections){const cabecalho=quebrarTexto(secao.heading,negrito,11,511);garantir(cabecalho.length*14+18);pagina.drawRectangle({x:36,y:y-cabecalho.length*14+4,width:523,height:cabecalho.length*14+8,color:rgb(0.9,0.96,0.93)});cabecalho.forEach((linha,i)=>pagina.drawText(linha,{x:44,y:y-i*14,size:11,font:negrito,color:rgb(0.02,0.28,0.19)}));y-=cabecalho.length*14+10;
    for(const item of secao.lines){const linhas=quebrarTexto(item,normal,8.5,507);for(const linha of linhas){garantir(12);pagina.drawText(linha,{x:44,y,size:8.5,font:normal,color:rgb(0.08,0.12,0.18)});y-=11;}y-=3;}y-=8;
  }
}

async function incorporarArquivos(pdf:PDFDocument,arquivos:ArquivoRelatorio[]){
  const negrito=await pdf.embedFont(StandardFonts.HelveticaBold);
  for(const arquivo of arquivos){
    try{
      const resposta=await fetch(`/api/admin/documentos-associacao/arquivo?key=${encodeURIComponent(arquivo.key)}`);
      if(!resposta.ok)continue;
      const bytes=new Uint8Array(await resposta.arrayBuffer());
      if(arquivo.tipo==="application/pdf"){
        const anexo=await PDFDocument.load(bytes,{ignoreEncryption:true});
        const paginas=await pdf.copyPages(anexo,anexo.getPageIndices());
        for(const pagina of paginas)pdf.addPage(pagina);
        continue;
      }
      const imagem=arquivo.tipo==="image/png"?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);
      const pagina=pdf.addPage([595.28,841.89]);
      pagina.drawRectangle({x:0,y:763,width:595.28,height:78,color:rgb(0.02,0.28,0.19)});
      const titulo=quebrarTexto(`${arquivo.grupo}: ${arquivo.nome}`.toLocaleUpperCase("pt-BR"),negrito,10,511).slice(0,3);
      titulo.forEach((linha,i)=>pagina.drawText(linha,{x:42,y:812-i*14,size:10,font:negrito,color:rgb(1,1,1)}));
      const escala=Math.min(511/imagem.width,660/imagem.height,1);
      pagina.drawImage(imagem,{x:(595.28-imagem.width*escala)/2,y:50+(680-imagem.height*escala)/2,width:imagem.width*escala,height:imagem.height*escala});
    }catch{}
  }
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
      const consolidado=await PDFDocument.create();
      const relatorios:RelatorioJson[]=[];
      for(const competencia of competencias){
        const parametros=new URLSearchParams({associacao,formato:"json",competencia});
        const resposta=await fetch(`/api/admin/prestacao-associacao/pdf?${parametros.toString()}`);
        if(!resposta.ok){const detalhe=await resposta.text().catch(()=>"");throw new Error(detalhe||`NÃO FOI POSSÍVEL CONSULTAR A COMPETÊNCIA ${competencia}.`);}
        relatorios.push(await resposta.json() as RelatorioJson);
      }
      for(const relatorio of relatorios)await adicionarRelatorio(consolidado,relatorio);
      const arquivos=[...new Map(relatorios.flatMap(relatorio=>relatorio.arquivos||[]).map(arquivo=>[arquivo.key,arquivo])).values()];
      await incorporarArquivos(consolidado,arquivos);
      const bytes=await consolidado.save();
      const blob=new Blob([bytes],{type:"application/pdf"});const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=`prestacao-aderes-${associacao.replace(/[^a-zA-Z0-9_-]/g,"-")}-${competencias.join("_")}.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
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
