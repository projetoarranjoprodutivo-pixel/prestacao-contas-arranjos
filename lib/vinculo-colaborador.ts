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
