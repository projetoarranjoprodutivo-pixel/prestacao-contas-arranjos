"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import type { PdfSection } from "@/lib/pdf";

export default function PdfMudas({ consulta }: { consulta: string }) {
  const [url, setUrl] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  async function gerar() {
    setOcupado(true);
    setErro("");
    try {
      const resposta = await fetch(`/api/admin/entregas-mudas/pdf?${consulta}&formato=dados`, { cache: "no-store" });
      if (resposta.status === 403) throw new Error("Entre novamente no painel para gerar o relatório.");
      if (!resposta.ok) throw new Error("Falha ao consultar as entregas. Tente novamente.");
      const { secoes }: { secoes: PdfSection[] } = await resposta.json();
      const { createPdf } = await import("@/lib/pdf");
      const bytes = await createPdf("RELATÓRIO CONSOLIDADO DE ENTREGAS DE MUDAS", secoes);
      setUrl(URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" })));
    } catch (e) {
      setErro(e instanceof Error && (e.message.startsWith("Entre novamente") || e.message.startsWith("Falha ao consultar")) ? e.message : "Não foi possível gerar o PDF das entregas. Tente novamente.");
    } finally {
      setOcupado(false);
    }
  }

  const estilo = "inline-flex h-11 items-center gap-2 rounded-xl bg-blue-800 px-5 text-sm font-bold text-white shadow-sm";
  return <div aria-live="polite">
    {url ? <a className={estilo} href={url} download={`entregas-mudas-${new URLSearchParams(consulta).getAll("competencias").join("-")}.pdf`}><Download size={16}/>Baixar PDF</a>
      : <button type="button" className={estilo} onClick={gerar} disabled={ocupado}><Download size={16}/>{ocupado ? "Gerando PDF…" : "Gerar PDF"}</button>}
    {erro && <p role="alert">{erro}</p>}
  </div>;
}
