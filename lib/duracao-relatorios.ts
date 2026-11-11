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
