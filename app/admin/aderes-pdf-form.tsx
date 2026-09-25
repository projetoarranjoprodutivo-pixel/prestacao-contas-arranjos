"use client";

import { useState } from "react";
import { Download, Plus, X } from "lucide-react";

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

      <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 text-sm font-bold text-white">
        <Download className="h-4 w-4" /> GERAR PRESTAÇÃO ADERES DOS MESES SELECIONADOS
      </button>
    </form>
  );
}
