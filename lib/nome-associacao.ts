// A interface usa caixa alta; a chave de agrupamento deve seguir o mesmo padrão.
export function normalizarNomeAssociacao(nome?: string | null) {
  const normalizado=(nome || "").normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR") || "SEM ASSOCIAÇÃO";
  const chave=normalizado.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9]/g, "");
  if(chave==="APROVIPA"||chave==="APPROVIPA")return "APPROVIPA";
  if(chave==="MUNIZCAF")return "MUNIZ CAF";
  return normalizado;
}
