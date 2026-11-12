import { and, eq, inArray, sql } from "drizzle-orm";
import type { ChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { colaboradores, prestacoes } from "@/db/schema";
import { associacaoAutorizadaConsultor, chaveAssociacaoConsultoria } from "@/lib/consultor-projeto";
import { atividadeExecutada, preencherDuracao, minutosDaAtividade, unidadeDuracaoDoRelatorio, type DuracaoAtividade } from "@/lib/duracao-relatorios";

type Atividade = DuracaoAtividade & { municipio?: string; tipoAtividade?: string };

function resumirAtividades(json: string, municipioRelatorio: string, totalMinutos: number) {
  let atividades: Atividade[] = [];
  try {
    const dados = JSON.parse(json);
    if (Array.isArray(dados)) atividades = dados.filter(item => item && typeof item === "object");
  } catch {}

  const unidadeLegada = unidadeDuracaoDoRelatorio(atividades, totalMinutos);
  const grupos = new Map<string, { municipio: string; tipo: string; quantidade: number; minutos: number }>();
  for (const atividade of atividades.filter(atividadeExecutada)) {
    const municipio = String(atividade.municipio || municipioRelatorio || "Não informado").trim();
    const tipo = String(atividade.tipoAtividade || "Não informado").trim();
    const chave = JSON.stringify([municipio.toUpperCase(), tipo.toUpperCase()]);
    const grupo = grupos.get(chave) ?? { municipio, tipo, quantidade: 0, minutos: 0 };
    grupo.quantidade++;
    grupo.minutos += minutosDaAtividade(preencherDuracao({ ...atividade, unidadeDuracao: atividade.unidadeDuracao || unidadeLegada }));
    grupos.set(chave, grupo);
  }
  return [...grupos.values()].sort((a, b) => a.municipio.localeCompare(b.municipio, "pt-BR") || a.tipo.localeCompare(b.tipo, "pt-BR"));
}

export const horas = (minutos: number) => (minutos / 60).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export async function dadosRelatorioCompilado(user: ChatGPTUser, competenciaSolicitada: unknown) {
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
  const normalizar = (coluna: typeof prestacoes.associacao | typeof colaboradores.associacao) =>
    sql`upper(replace(replace(replace(${coluna}, ' ', ''), '.', ''), '-', ''))`;

  const registros = gerar ? await db.select({
    id: prestacoes.id,
    tecnico: colaboradores.nomeCompleto,
    municipio: prestacoes.municipio,
    atividades: prestacoes.atividadesJson,
    totalMinutos: prestacoes.totalMinutos,
  }).from(prestacoes).innerJoin(colaboradores, eq(colaboradores.authUserId, prestacoes.authUserId)).where(and(
    eq(prestacoes.competencia, competencia),
    inArray(prestacoes.status, ["enviado", "importado"]),
    sql`lower(replace(replace(trim(${colaboradores.cargo}), 'É', 'e'), 'é', 'e')) = 'tecnico de campo'`,
    sql`${normalizar(colaboradores.associacao)} in (${valores})`,
    sql`${normalizar(prestacoes.associacao)} in (${valores})`,
  )).orderBy(colaboradores.nomeCompleto) : [];

  const relatorios = registros.map(registro => ({ ...registro, grupos: resumirAtividades(registro.atividades, registro.municipio, registro.totalMinutos) }));
  const grupos = relatorios.flatMap(relatorio => relatorio.grupos);
  const atividades = grupos.reduce((total, grupo) => total + grupo.quantidade, 0);
  const minutos = grupos.reduce((total, grupo) => total + grupo.minutos, 0);

  const consultor = { nome: cadastro.nomeCompleto, nomeEmpresarial: cadastro.nomeEmpresarial, mei: cadastro.mei };
  return { consultor, associacao, competencia, competenciaValida, gerar, relatorios, atividades, minutos };
}
