import { redirect } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { colaboradores, prestacoes } from "@/db/schema";
import { associacaoAutorizadaConsultor, chaveAssociacaoConsultoria } from "@/lib/consultor-projeto";
import { atividadeExecutada, preencherDuracao, minutosDaAtividade, unidadeDuracaoDoRelatorio, type DuracaoAtividade } from "@/lib/duracao-relatorios";
import { ImprimirRelatorio } from "./imprimir";

export const dynamic = "force-dynamic";

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

const horas = (minutos: number) => (minutos / 60).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export default async function RelatorioCompilado({ searchParams }: {
  searchParams: Promise<{ competencia?: string }>;
}) {
  const user = await requireChatGPTUser("/painel/relatorio-compilado");
  const db = getDb();
  const [cadastro] = await db.select({
    cargo: colaboradores.cargo,
    associacao: colaboradores.associacao,
    associacoesJson: colaboradores.associacoesJson,
    documentoValidade: colaboradores.documentoValidade,
  }).from(colaboradores).where(eq(colaboradores.authUserId, user.userId)).limit(1);
  if (!cadastro ||
      new Date(cadastro.documentoValidade + "T23:59:59") < new Date()) redirect("/painel");

  const associacao = associacaoAutorizadaConsultor(user, cadastro);
  if (!associacao) redirect("/painel");

  const params = await searchParams;
  const hoje = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(new Date());
  const competenciaValida = typeof params.competencia === "string" && /^20\d{2}-(0[1-9]|1[0-2])$/.test(params.competencia);
  const competencia = competenciaValida ? params.competencia! : hoje;
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

  return <main className="mx-auto max-w-5xl space-y-6 px-5 py-8 text-slate-900">
    <a href="/painel" className="font-bold text-emerald-800 print:hidden">Voltar à área do colaborador</a>
    <h1 className="text-3xl font-black">Relatório compilado dos técnicos</h1>
    <form action="/painel/relatorio-compilado" className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4 print:hidden">
      <p className="self-center font-semibold">{associacao}</p>
      <label className="grid gap-1 text-sm font-bold">Competência
        <input name="competencia" type="month" required defaultValue={competencia} className="rounded-lg border px-3 py-2"/>
      </label>
      <button className="rounded-xl bg-emerald-800 px-4 py-2 font-bold text-white">Gerar relatório compilado</button>
    </form>
    {params.competencia !== undefined && !competenciaValida && <p role="alert">Informe uma competência válida.</p>}
    {gerar && <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <h2 className="text-xl font-bold">{associacao} · {competencia.split("-").reverse().join("/")}</h2>
        {relatorios.length > 0 && <div className="print:hidden"><ImprimirRelatorio/></div>}
      </div>
      {relatorios.length === 0 ? <p>Nenhuma prestação de contas dos técnicos registrada para a competência selecionada.</p> : <>
        <p className="rounded-xl bg-emerald-50 p-4 font-semibold">
          Relatórios consolidados {relatorios.length} · Atividades realizadas {atividades} · Carga horária {horas(minutos)} h
        </p>
        {relatorios.map(relatorio => <section key={relatorio.id} className="space-y-2">
          <h3 className="text-lg font-bold">{relatorio.tecnico}</h3>
          {relatorio.grupos.length === 0 ? <p>Nenhuma atividade realizada informada.</p> :
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100"><tr><th className="p-2">Município</th><th className="p-2">Atividade</th><th className="p-2 text-right">Quantidade</th><th className="p-2 text-right">Horas</th></tr></thead>
              <tbody>{relatorio.grupos.map(grupo => <tr className="border-b" key={JSON.stringify([grupo.municipio, grupo.tipo])}>
                <td className="p-2">{grupo.municipio}</td><td className="p-2">{grupo.tipo}</td><td className="p-2 text-right">{grupo.quantidade}</td><td className="p-2 text-right">{horas(grupo.minutos)}</td>
              </tr>)}</tbody>
            </table>}
        </section>)}
      </>}
    </>}
  </main>;
}
