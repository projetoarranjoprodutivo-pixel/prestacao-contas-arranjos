"use client";

export function ImprimirRelatorio() {
  return <button type="button" onClick={() => window.print()} className="rounded-xl bg-emerald-800 px-4 py-2 font-bold text-white">
    Imprimir ou salvar em PDF
  </button>;
}
