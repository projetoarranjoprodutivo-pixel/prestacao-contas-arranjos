import { and, eq, inArray, sql } from "drizzle-orm";
import type { ChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { colaboradores, planosTrabalho, prestacoes } from "@/db/schema";
import { associacaoAutorizadaConsultor, chaveAssociacaoConsultoria } from "@/lib/consultor-projeto";
import { atividadeExecutada, apurarDuracoesRelatorio, minutosDaAtividade, type DuracaoAtividade } from "@/lib/duracao-relatorios";

type Atividade = DuracaoAtividade & {
  municipio?: string; tipoAtividade?: string; comunidade?: string; propriedade?: string;
  agricultor?: string; beneficiario?: string; inicio?: string; hora?: string; resumo?: string; observacao?: string;
  tipoMuda?: string; quantidadeMudas?: string;
};
type Anexo = { key: string; nome: string; tipo?: string };

function lista<T>(json: string) {
  try {
    const dados = JSON.parse(json);
    if (Array.isArray(dados)) return dados.filter(item => item && typeof item === "object") as T[];
  } catch {}
  return [] as T[];
}

function resumirAtividades(atividades: Atividade[], municipioRelatorio: string) {
  const grupos = new Map<string, { municipio: string; tipo: string; quantidade: number; minutos: number }>();
  for (const atividade of atividades.filter(atividadeExecutada)) {
    const municipio = String(atividade.municipio || municipioRelatorio || "Não informado").trim();
    const tipo = String(atividade.tipoAtividade || "Não informado").trim();
    const chave = JSON.stringify([municipio.toUpperCase(), tipo.toUpperCase()]);
    const grupo = grupos.get(chave) ?? { municipio, tipo, quantidade: 0, minutos: 0 };
    grupo.quantidade++;
    grupo.minutos += minutosDaAtividade(atividade);
    grupos.set(chave, grupo);
  }
  return [...grupos.values()].sort((a, b) => a.municipio.localeCompare(b.municipio, "pt-BR") || a.tipo.localeCompare(b.tipo, "pt-BR"));
}

export const horas = (minutos: number) => (minutos / 60).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export async function dadosRelatorioCompilado(user: ChatGPTUser, competenciaSolicitada: unknown, prestacaoId?: number) {
  const db = getDb();
  const [cadastro] = await db.select({
    cargo: colaboradores.cargo,
    nomeCompleto: colaboradores.nomeCompleto,
    nomeEmpresarial: colaboradores.nomeEmpresarial,
    mei: colaboradores.mei,
    associacao: colaboradores.associacao,
    associacoesJson: colaboradores.associacoesJson,
    documentoValidade: colaboradores.documentoValidade,
  }).from(colaboradores).where(eq(colaboradores.authUserId, user.userId)).limit(1);
  if (!cadastro ||
      new Date(cadastro.documentoValidade + "T23:59:59") < new Date()) return null;

  const associacao = associacaoAutorizadaConsultor(user, cadastro);
  if (!associacao) return null;

  const hoje = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(new Date());
  const competenciaValida = typeof competenciaSolicitada === "string" && /^20\d{2}-(0[1-9]|1[0-2])$/.test(competenciaSolicitada);
  const competencia = competenciaValida ? competenciaSolicitada : hoje;
  const gerar = competenciaValida;
  const chave = chaveAssociacaoConsultoria(associacao);
  const chaves = chave === "APPROVIPA" ? ["APPROVIPA", "APROVIPA"] : [chave];
  const valores = sql.join(chaves.map(item => sql`${item}`), sql`, `);
  const normalizar = (coluna: typeof prestacoes.associacao | typeof colaboradores.associacao | typeof planosTrabalho.associacao) =>
    sql`upper(replace(replace(replace(${coluna}, ' ', ''), '.', ''), '-', ''))`;

  const registros = gerar ? await db.select({
    id: prestacoes.id,
    tecnico: colaboradores.nomeCompleto,
    municipio: prestacoes.municipio,
    atividades: sql<string>`COALESCE((SELECT json_group_array(json_remove(value, '$.assinaturaProdutor', '$.assinaturaTecnico')) FROM json_each(${prestacoes.atividadesJson})), '[]')`,
    observacoes: prestacoes.observacoes,
    anexosJson: prestacoes.anexosJson,
    agendaJson: planosTrabalho.agendaJson,
    totalMinutos: prestacoes.totalMinutos,
    status: prestacoes.status,
  }).from(prestacoes).innerJoin(colaboradores, eq(colaboradores.authUserId, prestacoes.authUserId)).leftJoin(planosTrabalho, and(
    eq(planosTrabalho.authUserId, prestacoes.authUserId),
    eq(planosTrabalho.competencia, prestacoes.competencia),
    eq(planosTrabalho.status, "importado"),
    sql`${normalizar(planosTrabalho.associacao)} in (${valores})`,
  )).where(and(
    prestacaoId === undefined ? undefined : eq(prestacoes.id, prestacaoId),
    eq(prestacoes.competencia, competencia),
    inArray(prestacoes.status, ["enviado", "importado"]),
    sql`lower(replace(replace(trim(${colaboradores.cargo}), 'É', 'e'), 'é', 'e')) = 'tecnico de campo'`,
    sql`${normalizar(colaboradores.associacao)} in (${valores})`,
    sql`${normalizar(prestacoes.associacao)} in (${valores})`,
  )).orderBy(colaboradores.nomeCompleto) : [];

  const relatorios = registros.map(registro => {
    const apuracao = apurarDuracoesRelatorio(lista<Atividade>(registro.atividades), registro.totalMinutos, registro.agendaJson, registro.status === "importado");
    const anexos = lista<Anexo>(registro.anexosJson);
    return { id: registro.id, tecnico: registro.tecnico, municipio: registro.municipio, observacoes: registro.observacoes, anexos,
      ...apuracao, grupos: resumirAtividades(apuracao.itens, registro.municipio) };
  });
  const grupos = relatorios.flatMap(relatorio => relatorio.grupos);
  const atividades = grupos.reduce((total, grupo) => total + grupo.quantidade, 0);
  const minutos = relatorios.reduce((total, relatorio) => total + relatorio.minutos, 0);
  const minutosAtividades = grupos.reduce((total, grupo) => total + grupo.minutos, 0);

  const consultor = { nome: cadastro.nomeCompleto, nomeEmpresarial: cadastro.nomeEmpresarial, mei: cadastro.mei };
  return { consultor, associacao, competencia, competenciaValida, gerar, relatorios, atividades, minutos, minutosAtividades };
}

export function caminhoAnexo(competencia: string, id: number, indice: number) {
  return `/painel/relatorio-compilado/anexo?${new URLSearchParams({ competencia, id: String(id), indice: String(indice) })}`;
}
