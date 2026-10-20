import {notaPertenceAoColaborador} from "@/lib/notas-servico";
import { categoriaDaNota } from "@/lib/classificacao-notas";
import {numeroMonetario} from "@/lib/moeda";
import { and, eq, inArray } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getAderesOrAdminUser } from "@/lib/admin";
import { getDb } from "@/db";
import { associacoes, colaboradores, documentosAssociacao, prestacoes } from "@/db/schema";
import { excelDate, fillXlsxTemplate, addXlsxDetailSheet, type CellValue } from "@/lib/xlsx-template";
import agricultoresIniciais from "@/data/agricultores-iniciais.json";
import { ehEntregaMudas, quantidadeEntregue } from "@/lib/entregas-mudas";

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
  unidadeDuracao?: "horas";
  resumo?: string;
};
type Arquivo = {
  key?: string;
  numeroNota?: string;
  categoriaNota?: string;
  nome?: string;
  descricao?: string;
  quantidade?: string;
  valor?: string;
  dataEmissao?: string;
  fornecedor?: string;
};
type AgricultorCadastro = { agricultor?: string; municipio?: string; comunidade?: string; propriedade?: string; telefone?: string };
type AgricultorInicial = { n: string; m: string; a: string };
type Registro = typeof prestacoes.$inferSelect;

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const texto = (value: unknown) => String(value ?? "").trim();
const lista = <T,>(json: string | null | undefined): T[] => {
  try { const value = JSON.parse(json || "[]"); return Array.isArray(value) ? value : []; }
  catch { return []; }
};
const tipoNormalizado = (atividade: Atividade) => texto(atividade.tipoAtividade).toLocaleLowerCase("pt-BR");
const chaveNome = (value: unknown) => texto(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleUpperCase("pt-BR");
const mesReferencia = (competencia: string) => new Intl.DateTimeFormat("pt-BR", {
  month: "long", year: "numeric", timeZone: "UTC",
}).format(new Date(`${competencia}-02T12:00:00Z`));

function numeroDocumento(value: unknown, monetario = false) {
  if(monetario)return numeroMonetario(value)||0;
  const original = texto(value).replace(/[^\d,.-]/g, "");
  if (!original) return 0;
  let normalizado = original;
  if (original.includes(",")) normalizado = original.replaceAll(".", "").replace(",", ".");
  else if (!monetario && /^-?\d{1,3}(\.\d{3})+$/.test(original)) normalizado = original.replaceAll(".", "");
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : 0;
}

function categoriaAquisicao(descricao: unknown) {
  const valor = chaveNome(descricao);
  if (/MUDA|PLANTULA/.test(valor)) return "Mudas";
  if (/SEMENTE/.test(valor)) return "Sementes";
  if (/ADUBO|FERTILIZANTE/.test(valor)) return "Adubo/Fertilizante";
  if (/CALCARIO|CORRETIVO/.test(valor)) return "Calcário/Corretivo";
  if (/IRRIGACAO/.test(valor)) return "Irrigação";
  if (/EQUIPAMENTO|MAQUINA|IMPLEMENTO/.test(valor)) return "Equipamento";
  return "Outros";
}

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
  if (!env.ASSETS) throw new Error("O vínculo de arquivos estáticos não está disponível.");
  const response = await env.ASSETS.fetch(new URL(`/templates/${nome}`, request.url));
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
  const eventos = atividades.filter(({ atividade }) => tipoNormalizado(atividade) !== "visita técnica" && !ehEntregaMudas(atividade));
  const tecnicos = [...new Set(relatorios.map((item) => usuarios.get(item.authUserId)?.nomeCompleto).filter(Boolean))] as string[];
  const dadosAtividades = new Map<string, { municipio: string; beneficios: Set<string>; quantidade: number; observacoes: Set<string> }>();
  for (const { atividade } of atividades) {
    const nome = texto(atividade.agricultor || atividade.beneficiario);
    if (!nome) continue;
    const chave = chaveNome(nome);
    const atual = dadosAtividades.get(chave) || { municipio: texto(atividade.municipio), beneficios: new Set<string>(), quantidade: 0, observacoes: new Set<string>() };
    atual.beneficios.add(texto(atividade.tipoAtividade) || "ASSISTÊNCIA TÉCNICA");
    if (atividade.tipoMuda) atual.beneficios.add(`MUDAS DE ${texto(atividade.tipoMuda)}`);
    atual.quantidade += quantidadeEntregue(atividade);
    if (atividade.resumo) atual.observacoes.add(texto(atividade.resumo));
    dadosAtividades.set(chave, atual);
  }

  const agricultores = new Map<string, { nome: string; municipio: string }>();
  const adicionarAgricultor = (nome: unknown, municipio: unknown) => {
    const nomeTexto = texto(nome);
    const municipioTexto = texto(municipio) === "NÃO INFORMADO" ? "" : texto(municipio);
    if (!nomeTexto) return;
    const chave = `${chaveNome(nomeTexto)}|${chaveNome(municipioTexto)}`;
    if (!agricultores.has(chave)) agricultores.set(chave, { nome: nomeTexto, municipio: municipioTexto });
  };
  (agricultoresIniciais as AgricultorInicial[])
    .filter((item) => item.a === associacao.nome)
    .forEach((item) => adicionarAgricultor(item.n, item.m));
  for (const usuario of usuarios.values()) {
    const associacoesUsuario = new Set([texto(usuario.associacao), ...lista<string>(usuario.associacoesJson)]);
    if (!associacoesUsuario.has(associacao.nome)) continue;
    lista<AgricultorCadastro>(usuario.atendimentosJson).forEach((item) => adicionarAgricultor(item.agricultor, item.municipio));
  }
  for (const { atividade } of atividades) adicionarAgricultor(atividade.agricultor || atividade.beneficiario, atividade.municipio);

  const identificacao: Record<string, CellValue> = {
    B4: texto(associacao.razaoSocial || associacao.nome),
    B5: texto(associacao.cnpj),
    B6: [associacao.municipio, associacao.uf].filter(Boolean).join(" / "),
    B7: competencias.map(mesReferencia).join("; "),
    B8: texto(associacao.presidenteNome),
    B9: tecnicos.join("; "),
  };
  const agricultoresCells: Record<string, CellValue> = {};
  [...agricultores.values()]
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .forEach((cadastro, index) => {
      const atividade = dadosAtividades.get(chaveNome(cadastro.nome));
      colocar(agricultoresCells, index + 2, ["A", "B", "C", "D", "E", "F"], [
        index + 1,
        cadastro.nome,
        cadastro.municipio || atividade?.municipio || "",
        atividade ? [...atividade.beneficios].join("; ") : "",
        atividade?.quantidade || "",
        atividade ? [...atividade.observacoes].join("; ") : "",
      ]);
    });
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
  // Aquisições são comprovadas por notas de compra; entregas e serviços não são compras.
  const notas = documentos.flatMap((documento) =>
    lista<Arquivo>(documento.notasFiscaisJson).map((arquivo) => ({ arquivo, competencia: documento.competencia }))
  ).filter(({ arquivo }) => categoriaDaNota(arquivo) === "mudas");
  notas.slice(0, 300).forEach(({ arquivo, competencia }, index) => {
    const row = index + 2;
    const descricao = texto(arquivo.descricao) || "ITEM NÃO DESCRITO";
    const quantidade = numeroDocumento(arquivo.quantidade);
    const valorTotal = numeroDocumento(arquivo.valor, true);
    const quantidadePlanilha = quantidade > 0 ? quantidade : "";
    const valorUnitario = valorTotal > 0 && quantidade > 0 ? Number((valorTotal / quantidade).toFixed(6)) : "";
    colocar(aquisicoesCells, row, ["B", "C", "D", "E", "F", "H", "I", "J", "K"], [
      excelDate(arquivo.dataEmissao),
      categoriaAquisicao(descricao),
      descricao,
      quantidadePlanilha,
      valorUnitario,
      texto(arquivo.fornecedor),
      texto(arquivo.nome) || "DOCUMENTO FISCAL ENVIADO",
      "",
      [
        `COMPETÊNCIA ${competencia}`,
        !quantidade && arquivo.quantidade ? `QUANTIDADE INFORMADA: ${texto(arquivo.quantidade)}` : "",
        "DOCUMENTO FISCAL ENVIADO NO PORTAL",
      ].filter(Boolean).join(" · "),
    ]);
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

function apurarHoras(relatorio: Registro) {
  const todas = lista<Atividade>(relatorio.atividadesJson);
  const atividades = todas.filter(a => a.executada !== false);
  const duracoes = atividades.map(a => {
    const valor = Number(String(a.duracao ?? "").trim().replace(",", "."));
    return Number.isFinite(valor) && valor > 0 ? valor * (a.unidadeDuracao === "horas" ? 60 : 1) : 0;
  });
  const informadas = duracoes.filter(valor => valor > 0).length;
  // Registros antigos sem unidade explícita têm formatos históricos distintos.
  // Seu total em minutos é a referência validada; não reinterpretar a duração.
  const totalSalvo = Math.max(0, Number(relatorio.totalMinutos) || 0);
  const unidadeAmbigua = atividades.some(a => a.unidadeDuracao !== "horas" && Number(String(a.duracao ?? "").replace(",", ".")) > 0);
  const minutos = unidadeAmbigua && totalSalvo > 0 ? totalSalvo : informadas ? duracoes.reduce((soma, valor) => soma + valor, 0) : todas.length && !atividades.length ? 0 : Math.max(0, Number(relatorio.totalMinutos) || 0);
  const horasPadrao = !informadas && minutos === 0 && (!todas.length || atividades.length > 0);
  return { minutos: horasPadrao ? 160 * 60 : minutos, horasPadrao, semDuracao: atividades.length - informadas, totalDeclarado: !informadas && minutos > 0 };
}

async function gerarHoras(
  request: Request,
  competencias: string[],
  trimestres: string[][],
  relatorios: Registro[],
  usuarios: Map<string, typeof colaboradores.$inferSelect>,
  documentos: Array<typeof documentosAssociacao.$inferSelect>,
) {
  const idsProfissionais = [...new Set(relatorios.map((item) => item.authUserId))];
  const profissionais = idsProfissionais.map(id => usuarios.get(id)?.nomeCompleto || "PROFISSIONAL NÃO IDENTIFICADO");
  const cargos = [...new Set(relatorios.map((item) => usuarios.get(item.authUserId)?.cargo).filter(Boolean))] as string[];
  const cells: Record<string, CellValue> = { B4: profissionais.join("; "), B5: profissionais.map((nome,i)=>`${nome}: ${usuarios.get(idsProfissionais[i])?.cargo||""}`).join("; "), B6: "VARIÁVEL — VER DETALHAMENTO" };
  const detalhes: CellValue[][] = [["PROFISSIONAL","CARGO / FUNÇÃO","COMPETÊNCIA","TRIMESTRE","NOTA FISCAL","TOTAL DAS NOTAS (R$)","VALOR DA HORA (R$)","HORAS TRABALHADAS","VALOR CORRESPONDENTE (R$)","SITUAÇÃO DA NOTA"]];
  const valoresTrimestres = [0,0,0,0];
  for(const [quarterIndex,meses] of trimestres.entries()) for(const mes of meses) for(const id of idsProfissionais){
    const usuario=usuarios.get(id); if(!usuario)continue;
    const registros=relatorios.filter(r=>r.authUserId===id&&r.competencia===mes);
    const horas=Math.max(160,registros.reduce((soma,r)=>soma+apurarHoras(r).minutos/60,0));
    const candidatos=documentos.filter(d=>d.competencia===mes).flatMap(d=>lista<Arquivo>(d.notasFiscaisJson)).filter(n=>categoriaDaNota(n)==="servico"&&notaPertenceAoColaborador(n,usuario,[...usuarios.values()]));
    const notas=[...new Map(candidatos.map(n=>[n.numeroNota?`NF:${n.numeroNota}`:texto(n.nome).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s*\(\d+\)/g,"").toUpperCase(),n])).values()];
    const totalNota=notas.reduce((soma,n)=>soma+numeroDocumento(n.valor,true),0);
    const valorHora=totalNota>0?totalNota/160:0;
    const valor=Number((horas*valorHora).toFixed(2)); valoresTrimestres[quarterIndex]+=valor;
    const linha=detalhes.length+1;
    detalhes.push([usuario.nomeCompleto,usuario.cargo,mes,`${quarterIndex+1}º TRIMESTRE`,notas.map(n=>n.numeroNota||n.nome).join("; "),totalNota||"",totalNota?{formula:`F${linha}/160`,cached:valorHora}:"",horas,totalNota?{formula:`ROUND(G${linha}*H${linha},2)`,cached:valor}:"",totalNota?"NOTA IDENTIFICADA":"SEM NOTA DE SERVIÇO IDENTIFICADA — VALOR NÃO CALCULADO"]);
  }
  const rows = [[11, 12, 13, 15], [19, 20, 21, 23], [27, 28, 29, 31], [35, 36, 37, 39]];
  rows.forEach(([periodoRow, previstasRow, trabalhadasRow, observacoesRow], quarterIndex) => {
    const meses = trimestres[quarterIndex]?.filter(competencia=>competencias.includes(competencia))||[];
    const registros = relatorios.filter((relatorio) => meses.includes(relatorio.competencia));
    cells[`B${periodoRow}`] = meses.map(mesReferencia).join("; ");
    cells[`B${previstasRow}`] = meses.length ? 160 * meses.length * idsProfissionais.length : "";
    cells[`B${trabalhadasRow}`] = meses.length ? Number(detalhes.slice(1).filter(linha=>linha[3]===`${quarterIndex+1}º TRIMESTRE`).reduce((total,linha)=>total+Number(linha[7]||0),0).toFixed(2)) : "";
    const horasApuradas = Number(cells[`B${trabalhadasRow}`] || 0);
    const horasPrevistas = Number(cells[`B${previstasRow}`] || 0);
    const ajustePrevistas = horasPrevistas > horasApuradas;
    if (ajustePrevistas) cells[`B${trabalhadasRow}`] = horasPrevistas;
    const linhaValor = trabalhadasRow + 1;
    const horasTrabalhadas = Number(cells[`B${trabalhadasRow}`] || 0);
    cells[`B${linhaValor}`] = {formula: `SUMIF('Detalhamento'!D2:D${detalhes.length},"${quarterIndex+1}º TRIMESTRE",'Detalhamento'!I2:I${detalhes.length})`, cached: Number(valoresTrimestres[quarterIndex].toFixed(2))};
    cells[`B${observacoesRow}`] = registros.flatMap((item) => {
      const apuracao = apurarHoras(item);
      const nome = usuarios.get(item.authUserId)?.nomeCompleto || "PROFISSIONAL NÃO IDENTIFICADO";
      return [texto(item.observacoes),
        apuracao.horasPadrao ? `${nome} (${item.competencia}): APLICADO PADRÃO DE 160 HORAS PREVISTAS, POIS O RELATÓRIO NÃO INFORMA HORAS.` : "",
        apuracao.totalDeclarado ? `${nome} (${item.competencia}): HORAS CONFORME TOTAL DECLARADO NO RELATÓRIO, SEM DURAÇÕES INDIVIDUAIS.` : "",
        apuracao.semDuracao && !apuracao.totalDeclarado && !apuracao.horasPadrao ? `${nome} (${item.competencia}): ${apuracao.semDuracao} ATIVIDADE(S) SEM DURAÇÃO INFORMADA; NÃO ACRESCENTAM HORAS.` : "",
      ].filter(Boolean);
    }).join("; ");
  });
  // O resumo deve somar as mesmas células dos quatro períodos.
  const totalPrevistas = rows.reduce((total, [, linha]) => total + Number(cells[`B${linha}`] || 0), 0);
  const totalTrabalhadas = rows.reduce((total, [, , linha]) => total + Number(cells[`B${linha}`] || 0), 0);
  cells.E5 = { formula: "SUM(B12,B20,B28,B36)", cached: totalPrevistas };
  cells.E6 = { formula: "SUM(B13,B21,B29,B37)", cached: totalTrabalhadas };
  cells.E7 = { formula: 'IF(E5=0,"",E6/E5)', cached: totalPrevistas ? totalTrabalhadas / totalPrevistas : "" };
  const totalValores = rows.reduce((total, [, , linha]) => {
    const valor = cells[`B${linha + 1}`];
    return total + (valor && typeof valor === "object" ? Number(valor.cached || 0) : 0);
  }, 0);
  cells.E8 = { formula: "SUM(B14,B22,B30,B38)", cached: Number(totalValores.toFixed(2)) };
  const template = await carregarTemplate(request, "controle-de-horas-fomento.xlsx");
  detalhes.push(["TOTAL","","","","", "","",{formula:`SUM(H2:H${detalhes.length})`,cached:totalTrabalhadas},{formula:`SUM(I2:I${detalhes.length})`,cached:Number(totalValores.toFixed(2))},""]);
  return addXlsxDetailSheet(fillXlsxTemplate(template, { "xl/worksheets/sheet1.xml": cells }), "Detalhamento", detalhes);
}

async function gerarExcel(request: Request) {
  if (!await getAderesOrAdminUser()) return new Response("Acesso restrito", { status: 403 });
  const url = new URL(request.url);
  const modelo = url.searchParams.get("modelo") || "agricultura";
  const nomeAssociacao = url.searchParams.get("associacao") || "";
  const competenciaUnica = url.searchParams.get("competencia") || "";
  const competencias = [...new Set([...url.searchParams.getAll("competencias"), ...(competenciaUnica ? [competenciaUnica] : [])])]
    .filter((value) => /^\d{4}-\d{2}$/.test(value)).sort();
  if (!competencias.length) return new Response("Selecione ao menos uma competência válida", { status: 400 });
  if (!['agricultura', 'horas'].includes(modelo)) return new Response("Modelo de planilha inválido", { status: 400 });
  const trimestres=Array.from({length:4},(_,indice)=>competencias.filter(mes=>url.searchParams.get(`mes_trimestre_${mes}`)===String(indice+1)));
  const mesesClassificados=new Set(trimestres.flat());competencias.filter(mes=>!mesesClassificados.has(mes)).forEach((mes,indice)=>trimestres[Math.min(3,Math.floor(indice/3))].push(mes));

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
    : await gerarHoras(request, competencias, trimestres, relatorios, usuarios, documentos);
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
