export type DuracaoAtividade = {
 data?: string;
 duracao?: string | number | null;
 unidadeDuracao?: string;
 executada?: boolean | string | number | null;
};

export function atividadeExecutada(a: DuracaoAtividade) {
 return !["false", "0", "não", "nao"].includes(String(a.executada ?? true).trim().toLowerCase());
}

export function preencherDuracao<T extends DuracaoAtividade>(atividade: T): T {
 if (!atividadeExecutada(atividade) || !atividade.data || String(atividade.duracao ?? "").trim()) return atividade;
 return { ...atividade, duracao: "180", unidadeDuracao: "minutos" };
}

export function minutosDaAtividade(a: DuracaoAtividade) {
 if (!atividadeExecutada(a)) return 0;
 const valor = Number(String(a.duracao ?? "").replace(",", "."));
 return Number.isFinite(valor) && valor > 0 ? valor * (a.unidadeDuracao === "horas" ? 60 : 1) : 0;
}

/** Relatórios antigos podem ter durações em horas sem indicar a unidade.
 *  O total persistido em minutos permite reconciliar os dois formatos.
 */
export function unidadeDuracaoDoRelatorio(atividades: DuracaoAtividade[], totalMinutos: number): "horas" | "minutos" {
  if (!Number.isFinite(totalMinutos) || totalMinutos <= 0) return "minutos";

  let minutosExplicitos = 0;
  let duracaoSemUnidade = 0;
  for (const atividade of atividades) {
    const minutos = minutosDaAtividade(atividade);
    if (atividade.unidadeDuracao) minutosExplicitos += minutos;
    else duracaoSemUnidade += minutos;
  }
  if (!duracaoSemUnidade) return "minutos";

  const restante = totalMinutos - minutosExplicitos;
  // Compara por proporção para distinguir a unidade mesmo quando o total
  // declarado inclui arredondamentos ou horas sem detalhe individual.
  return restante / duracaoSemUnidade > Math.sqrt(60) ? "horas" : "minutos";
}
