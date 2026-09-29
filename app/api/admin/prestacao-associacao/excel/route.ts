import { and, eq, inArray } from "drizzle-orm";
import { getAdminUser } from "@/lib/admin";
import { getDb } from "@/db";
import { associacoes, colaboradores, documentosAssociacao, prestacoes } from "@/db/schema";
import { excelDate, fillXlsxTemplate, type CellValue } from "@/lib/xlsx-template";

export const runtime = "edge";

type Atividade = {
  executada?: boolean;
  municipio?: string;
  comunidade?: string;
  propriedade?: string;
  agricultor?: string;
  beneficiario?: string;
  tipoAtividade?: string;
  tipoMuda?: string;
  quantidadeMudas?: string;
  data?: string;
  duracao?: string;
  resumo?: string;
};
type Arquivo = { nome?: string };
type Registro = typeof prestacoes.$inferSelect;

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const texto = (value: unknown) => String(value ?? "").trim();
const lista = <T,>(json: string | null | undefined): T[] => {
  try { const value = JSON.parse(json || "[]"); return Array.isArray(value) ? value : []; }
  catch { return []; }
};
const tipoNormalizado = (atividade: Atividade) => texto(atividade.tipoAtividade).toLocaleLowerCase("pt-BR");
const mesReferencia = (competencia: string) => new Intl.DateTimeFormat("pt-BR", {
  month: "long", year: "numeric", timeZone: "UTC",
}).format(new Date(`${competencia}-02T12:00:00Z`));

function colocar(cells: Record<string, CellValue>, row: number, columns: string[], values: CellValue[]) {
  columns.forEach((column, index) => { cells[`${column}${row}`] = values[index] ?? ""; });
}

function atividadesDosRelatorios(relatorios: Registro[], usuarios: Map<string, typeof colaboradores.$inferSelect>) {
  return relatorios.flatMap((relatorio) =>
    lista<Atividade>(relatorio.atividadesJson)
      .filter((atividade) => atividade.executada !== false)
      .map((atividade) => ({ atividade, relatorio, usuario: usuarios.get(relatorio.authUserId) }))
  );
}

async function carregarTemplate(request: Request, nome: string) {
  const response = await fetch(new URL(`/templates/${nome}`, request.url));
  if (!response.ok) throw new Error("Não foi possível carregar o modelo oficial da planilha.");
  return new Uint8Array(await response.arrayBuffer());
}

async function gerarAgricultura(
  request: Request,
  associacao: typeof associacoes.$inferSelect,
  competencias: string[],
  relatorios: Registro[],
  usuarios: Map<string, typeof colaboradores.$inferSelect>,
  documentos: Array<typeof documentosAssociacao.$inferSelect>,
) {
  const atividades = atividadesDosRelatorios(relatorios, usuarios);
  const visitas = atividades.filter(({ atividade }) => tipoNormalizado(atividade) === "visita técnica");
  const eventos = atividades.filter(({ atividade }) => !["visita técnica", "entrega de mudas"].includes(tipoNormalizado(atividade)));
  const entregas = atividades.filter(({ atividade }) => tipoNormalizado(atividade) === "entrega de mudas");
  const tecnicos = [...new Set(relatorios.map((item) => usuarios.get(item.authUserId)?.nomeCompleto).filter(Boolean))] as string[];
  const agricultores = new Map<string, { municipio: string; beneficios: Set<string>; quantidade: number; observacoes: Set<string> }>();
  for (const { atividade } of atividades) {
    const nome = texto(atividade.agricultor || atividade.beneficiario);
    if (!nome) continue;
    const atual = agricultores.get(nome) || { municipio: texto(atividade.municipio), beneficios: new Set<string>(), quantidade: 0, observacoes: new Set<string>() };
    atual.beneficios.add(texto(atividade.tipoAtividade) || "ASSISTÊNCIA TÉCNICA");
    if (atividade.tipoMuda) atual.beneficios.add(`MUDAS DE ${texto(atividade.tipoMuda)}`);
    atual.quantidade += Number(atividade.quantidadeMudas) || 0;
    if (atividade.resumo) atual.observacoes.add(texto(atividade.resumo));
    agricultores.set(nome, atual);
  }

  const identificacao: Record<string, CellValue> = {
    B4: texto(associacao.razaoSocial || associacao.nome),
    B5: texto(associacao.cnpj),
    B6: [associacao.municipio, associacao.uf].filter(Boolean).join(" / "),
    B7: competencias.map(mesReferencia).join("; "),
    B8: texto(associacao.presidenteNome),
    B9: tecnicos.join("; "),
  };
  const agricultoresCells: Record<string, CellValue> = {};
  [...agricultores.entries()].slice(0, 200).forEach(([nome, item], index) => colocar(agricultoresCells, index + 2, ["B", "C", "D", "E", "F"], [
    nome, item.municipio, [...item.beneficios].join("; "), item.quantidade || "", [...item.observacoes].join("; "),
  ]));
  const visitasCells: Record<string, CellValue> = {};
  visitas.slice(0, 300).forEach(({ atividade, usuario }, index) => colocar(visitasCells, index + 2, ["B", "C", "D", "E", "F", "G", "H"], [
    excelDate(atividade.data), texto(usuario?.nomeCompleto), texto(atividade.agricultor || atividade.beneficiario), texto(atividade.municipio),
    texto(atividade.tipoMuda || atividade.tipoAtividade), atividade.quantidadeMudas ? `${atividade.quantidadeMudas} ${texto(atividade.tipoMuda)}` : "", texto(atividade.resumo),
  ]));
  const eventosCells: Record<string, CellValue> = {};
  eventos.slice(0, 200).forEach(({ atividade, usuario, relatorio }, index) => colocar(eventosCells, index + 2, ["B", "C", "D", "E", "F", "G", "H", "I"], [
    excelDate(atividade.data), texto(atividade.tipoAtividade), texto(atividade.resumo), [atividade.comunidade, atividade.municipio].filter(Boolean).join(" - "),
    texto(usuario?.nomeCompleto), atividade.agricultor ? 1 : "", texto(atividade.resumo), texto(relatorio.observacoes),
  ]));
  const aquisicoesCells: Record<string, CellValue> = {};
  entregas.slice(0, 300).forEach(({ atividade }, index) => colocar(aquisicoesCells, index + 2, ["B", "C", "D", "E", "H", "I", "J", "K"], [
    excelDate(atividade.data), "Mudas", texto(atividade.tipoMuda), Number(atividade.quantidadeMudas) || "", "", "",
    texto(atividade.agricultor || atividade.beneficiario || atividade.comunidade), texto(atividade.resumo),
  ]));
  const notas = documentos.flatMap((item) => lista<Arquivo>(item.notasFiscaisJson)).filter((item) => item.nome);
  notas.slice(0, Math.max(0, 300 - entregas.length)).forEach((arquivo, index) => {
    const row = Math.min(entregas.length, 300) + index + 2;
    aquisicoesCells[`I${row}`] = texto(arquivo.nome);
    aquisicoesCells[`K${row}`] = "DOCUMENTO FISCAL ENVIADO NO PORTAL";
  });

  const template = await carregarTemplate(request, "controle-agricultura-familiar-fomento.xlsx");
  return fillXlsxTemplate(template, {
    "xl/worksheets/sheet1.xml": identificacao,
    "xl/worksheets/sheet2.xml": agricultoresCells,
    "xl/worksheets/sheet3.xml": visitasCells,
    "xl/worksheets/sheet4.xml": eventosCells,
    "xl/worksheets/sheet5.xml": aquisicoesCells,
  });
}

async function gerarHoras(
  request: Request,
  competencias: string[],
  relatorios: Registro[],
  usuarios: Map<string, typeof colaboradores.$inferSelect>,
) {
  const profissionais = [...new Set(relatorios.map((item) => usuarios.get(item.authUserId)?.nomeCompleto).filter(Boolean))] as string[];
  const cargos = [...new Set(relatorios.map((item) => usuarios.get(item.authUserId)?.cargo).filter(Boolean))] as string[];
  const cells: Record<string, CellValue> = { B4: profissionais.join("; "), B5: cargos.join("; "), B6: "" };
  const rows = [[11, 12, 13, 15], [19, 20, 21, 23], [27, 28, 29, 31], [35, 36, 37, 39]];
  rows.forEach(([periodoRow, previstasRow, trabalhadasRow, observacoesRow], quarterIndex) => {
    const meses = competencias.filter((competencia) => Math.floor((Number(competencia.slice(5, 7)) - 1) / 3) === quarterIndex);
    const registros = relatorios.filter((relatorio) => meses.includes(relatorio.competencia));
    cells[`B${periodoRow}`] = meses.map(mesReferencia).join("; ");
    cells[`B${previstasRow}`] = "";
    cells[`B${trabalhadasRow}`] = registros.length ? Number((registros.reduce((total, item) => total + item.totalMinutos, 0) / 60).toFixed(2)) : "";
    cells[`B${observacoesRow}`] = registros.map((item) => texto(item.observacoes)).filter(Boolean).join("; ");
  });
  const template = await carregarTemplate(request, "controle-de-horas-fomento.xlsx");
  return fillXlsxTemplate(template, { "xl/worksheets/sheet1.xml": cells });
}

async function gerarExcel(request: Request) {
  if (!await getAdminUser()) return new Response("Acesso restrito", { status: 403 });
  const url = new URL(request.url);
  const modelo = url.searchParams.get("modelo") || "agricultura";
  const nomeAssociacao = url.searchParams.get("associacao") || "";
  const competenciaUnica = url.searchParams.get("competencia") || "";
  const competencias = [...new Set([...url.searchParams.getAll("competencias"), ...(competenciaUnica ? [competenciaUnica] : [])])]
    .filter((value) => /^\d{4}-\d{2}$/.test(value)).sort();
  if (!competencias.length) return new Response("Selecione ao menos uma competência válida", { status: 400 });
  if (!['agricultura', 'horas'].includes(modelo)) return new Response("Modelo de planilha inválido", { status: 400 });

  const db = getDb();
  const associacao = await db.query.associacoes.findFirst({ where: and(eq(associacoes.nome, nomeAssociacao), eq(associacoes.ativo, true)) });
  if (!associacao) return new Response("Associação não encontrada", { status: 404 });
  const [relatorios, cadastros, documentos] = await Promise.all([
    db.select().from(prestacoes).where(and(eq(prestacoes.associacao, associacao.nome), inArray(prestacoes.competencia, competencias))),
    db.select().from(colaboradores),
    db.select().from(documentosAssociacao).where(and(eq(documentosAssociacao.associacao, associacao.nome), inArray(documentosAssociacao.competencia, competencias))),
  ]);
  const usuarios = new Map(cadastros.map((item) => [item.authUserId, item]));
  const arquivo = modelo === "agricultura"
    ? await gerarAgricultura(request, associacao, competencias, relatorios, usuarios, documentos)
    : await gerarHoras(request, competencias, relatorios, usuarios);
  const sufixo = modelo === "agricultura" ? "controle-agricultura-familiar" : "controle-de-horas";
  const associacaoArquivo = associacao.nome.replace(/[^a-zA-Z0-9_-]/g, "-");
  return new Response(arquivo.buffer.slice(arquivo.byteOffset, arquivo.byteOffset + arquivo.byteLength), {
    headers: {
      "content-type": XLSX_TYPE,
      "content-disposition": `attachment; filename="${sufixo}-${associacaoArquivo}-${competencias.join("_")}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  try {
    return await gerarExcel(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida na geração do Excel";
    return Response.json({ message }, { status: 500 });
  }
}
