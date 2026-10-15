// A interface usa caixa alta; a chave de agrupamento deve seguir o mesmo padrão.
export function normalizarNomeAssociacao(nome?: string | null) {
  return (nome || "").normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR") || "SEM ASSOCIAÇÃO";
}
