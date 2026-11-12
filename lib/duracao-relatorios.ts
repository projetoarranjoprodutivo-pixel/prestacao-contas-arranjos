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
export function unidadeDuracaoDoRelatorio(atividades: DuracaoAtividade[], totalMinutos: number, unidadePlano?: "horas" | "minutos"): "horas" | "minutos" {
  if (unidadePlano) return unidadePlano;
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

type AtividadeComPlano = DuracaoAtividade & { municipio?: string; tipoAtividade?: string };

export function unidadeConfirmadaNoPlano(atividades: AtividadeComPlano[], agendaJson?: string | null) {
  let agenda: Array<AtividadeComPlano & { duracaoEstimada?: string }> = [];
  try {
    const dados = JSON.parse(agendaJson || "[]");
    if (Array.isArray(dados)) agenda = dados;
  } catch {}
  if (!agenda.length || agenda.length !== atividades.length) return undefined;
  let horas = 0, minutos = 0;
  atividades.forEach((atividade, indice) => {
    const prevista = agenda[indice];
    if (!prevista || !atividadeExecutada(atividade) || atividade.unidadeDuracao ||
        !atividade.data || atividade.data !== prevista.data || atividade.tipoAtividade !== prevista.tipoAtividade ||
        atividade.municipio !== prevista.municipio) return;
    const valor = minutosDaAtividade(atividade);
    const estimada = Number(String(prevista.duracaoEstimada ?? "").replace(",", "."));
    if (!(valor > 0 && estimada > 0)) return;
    if (Math.abs(valor - estimada) < 0.001) horas++;
    if (Math.abs(valor / 60 - estimada) < 0.001) minutos++;
  });
  if (horas && !minutos) return "horas" as const;
  if (minutos && !horas) return "minutos" as const;
}

export function apurarDuracoesRelatorio<T extends AtividadeComPlano>(atividades: T[], totalSalvo: number, agendaJson?: string | null, preservarTotalSalvo = false) {
  const unidade = unidadeDuracaoDoRelatorio(atividades, totalSalvo, unidadeConfirmadaNoPlano(atividades, agendaJson));
  const itens = atividades.map(atividade => preencherDuracao({ ...atividade, unidadeDuracao: atividade.unidadeDuracao || unidade }));
  const minutosAtividades = itens.reduce((soma, item) => soma + minutosDaAtividade(item), 0);
  const legado = atividades.some(atividade => !atividade.unidadeDuracao && minutosDaAtividade(atividade) > 0);
  const minutosDeclarados = Number.isFinite(totalSalvo) && totalSalvo > 0 ? totalSalvo : 0;
  const minutos = itens.length && !itens.some(atividadeExecutada) ? 0 :
    (legado || preservarTotalSalvo || !minutosAtividades) && minutosDeclarados ? minutosDeclarados : minutosAtividades;
  return { itens, minutos, minutosAtividades };
}

export function minutosDuracaoImportada(texto: string) {
  const valor = texto.trim().toLowerCase();
  const horario = valor.match(/^(\d{1,2}):([0-5]\d)(?::00)?(?:\s*(?:h|horas?))?$/);
  const quantidade = valor.match(/^(\d+(?:[.,]\d+)?)\s*(h|hs|hrs?|horas?|m|min(?:utos?)?)?\.?$/);
  if (!horario && !quantidade) return null;
  const minutos = horario ? Number(horario[1]) * 60 + Number(horario[2]) :
    Number(quantidade![1].replace(",", ".")) * (quantidade![2]?.startsWith("h") ? 60 : 1);
  // Decimais menores que um sem unidade exigem a conferência da fonte.
  return minutos >= 1 && minutos <= 1440 ? Math.round(minutos) : null;
}

export function formatarDuracao(minutos: number) {
  const total = Number.isFinite(minutos) ? Math.max(0, Math.round(minutos)) : 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function lerDuracaoHorasMinutos(texto: string) {
  const partes = texto.trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!partes) return null;
  const minutos = Number(partes[1]) * 60 + Number(partes[2]);
  return minutos <= 1440 ? minutos : null;
}
