import { associacoesDoColaborador } from "@/lib/notas-servico";

export const PERFIL_CONSULTOR_PROJETO = "consultor_projeto";

export const chaveAssociacaoConsultoria = (nome: string) =>
  nome.toUpperCase().replace(/[ .-]/g, "").replace(/^APROVIPA$/, "APPROVIPA");

export function associacaoAutorizadaConsultor(
  usuario: { role: string; associacao: string | null },
  cadastro: { cargo: string; associacao: string | null; associacoesJson: string },
) {
  const cargo = cadastro.cargo.trim().toLowerCase();
  if (usuario.role !== PERFIL_CONSULTOR_PROJETO || !usuario.associacao ||
      !["consultor do projeto", "consultor de projetos"].includes(cargo)) return undefined;
  const chaveAutorizada = chaveAssociacaoConsultoria(usuario.associacao);
  return associacoesDoColaborador(cadastro).find(nome => chaveAssociacaoConsultoria(nome) === chaveAutorizada);
}
