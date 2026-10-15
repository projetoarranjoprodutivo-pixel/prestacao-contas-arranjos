type Vinculo = { dataAdmissao?: string | null; dataSaida?: string | null };

// O mês da saída já não gera cobrança, independentemente do dia informado.
export function ativoNaCompetencia(usuario: Vinculo, competencia: string) {
  const admissao = (usuario.dataAdmissao || "2026-03-17").slice(0, 7);
  const saida = (usuario.dataSaida || "").slice(0, 7);
  return competencia >= admissao && (!saida || competencia < saida);
}

export function dataSaidaValida(saida: string, admissao: string) {
  if (!saida) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(saida)
    && Number.isFinite(Date.parse(saida))
    && new Date(saida).toISOString().slice(0, 10) === saida
    && saida >= admissao;
}

// O acesso permanece válido no dia da saída e é bloqueado no dia seguinte,
// considerando a data local do projeto no Brasil.
export function saidaJaOcorreu(dataSaida: string | null | undefined, agora = new Date()) {
  if (!dataSaida) return false;
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(agora);
  return dataSaida < hoje;
}
