"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function ModuloRecolhivel({ titulo, memoria, children, className, id }: {
  titulo: string; memoria: string; children: ReactNode; className?: string; id?: string;
}) {
  const [aberto, setAberto] = useState(true);
  const conteudoId = useId();
  const chave = `admin:modulo:${memoria}`;
  useEffect(() => {
    try { setAberto(localStorage.getItem(chave) !== "fechado"); } catch {}
    const revelar = () => {
      const alvo = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if ((alvo && document.getElementById(conteudoId)?.contains(alvo)) || (id && location.hash === `#${id}`)) setAberto(true);
    };
    revelar();
    window.addEventListener("hashchange", revelar);
    return () => window.removeEventListener("hashchange", revelar);
  }, [chave, conteudoId, id]);
  function alternar() {
    const proximo = !aberto;
    setAberto(proximo);
    try { localStorage.setItem(chave, proximo ? "aberto" : "fechado"); } catch {}
  }
  return <section id={id} className={`${className || ""} self-start`}>
    <button type="button" onClick={alternar} aria-expanded={aberto} aria-controls={conteudoId}
      className="mb-3 flex w-full items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-left text-sm font-black text-emerald-950 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-700 print:hidden">
      <span>{titulo}</span><span className="flex shrink-0 items-center gap-2 text-xs">{aberto ? "RECOLHER" : "EXPANDIR"}{aberto ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}</span>
    </button>
    <div id={conteudoId} hidden={!aberto} className="print:!block">{children}</div>
  </section>;
}
