import { incluirFotosDoTecnico } from "./fotos";
import { atividadeExecutada } from "@/lib/duracao-relatorios";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { createPdf, type PdfSection } from "@/lib/pdf";
import { PROJETO_LOGO_BASE64 } from "@/lib/pdf-assets";
import { dadosRelatorioCompilado, horas, caminhoAnexo } from "../dados";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const usuario = await getChatGPTUser();
  if (!usuario) return new Response("Entre para gerar o relatório.", { status: 401 });

  const competencia = new URL(request.url).searchParams.get("competencia");
  const dados = await dadosRelatorioCompilado(usuario, competencia);
  if (!dados) return new Response("Acesso restrito à associação do consultor.", { status: 403 });
  if (!dados.competenciaValida) return new Response("Selecione uma competência válida.", { status: 400 });
  if (!dados.relatorios.length) return new Response("Nenhuma prestação de contas para a competência selecionada.", { status: 404 });

  const periodo = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${dados.competencia}-01T00:00:00Z`));
  const orcamentoFotos = { restante: 24 * 1024 * 1024 };
  const secoes: PdfSection[] = [
    { heading: "Identificação", lines: [`Associação: ${dados.associacao}`, `Competência: ${periodo}`] },
    ...dados.relatorios.flatMap(relatorio => {
      const secoes: PdfSection[] = [{
        heading: relatorio.tecnico,
        lines: [
          `Carga horária da prestação: ${horas(relatorio.minutos)}`,
          `Soma das durações das atividades: ${horas(relatorio.minutosAtividades)}`,
          ...relatorio.grupos.map(grupo => `${grupo.municipio} | ${grupo.tipo} | ATIVIDADES: ${grupo.quantidade} | DURAÇÃO: ${horas(grupo.minutos)}`),
        ],
      }];
      const municipios = [...new Set(relatorio.grupos.map(grupo => grupo.municipio).filter(nome => nome !== "Não informado"))];
      const tipos = [...new Set(relatorio.grupos.map(grupo => grupo.tipo).filter(nome => nome !== "Não informado"))];
      const exemplos = [...new Set(relatorio.itens.filter(atividadeExecutada)
        .map(item => item.resumo?.trim().replace(/\s+/g, " ") || "")
        .filter(texto => texto && !/^atividade realizada conforme/i.test(texto)))].slice(0, 3);
      const lista = new Intl.ListFormat("pt-BR", { type: "conjunction" });
      const local = municipios.length ? ` em ${lista.format(municipios)}` : "";
      const atividades = tipos.length ? `, com registros de ${lista.format(tipos.map(tipo => tipo.toLocaleLowerCase("pt-BR")))}` : "";
      const texto = relatorio.grupos.length
        ? `No período, o técnico realizou atividades${local}${atividades}.`
        : "Não há atividades executadas registradas para o período.";
      secoes.push({
        heading: "Atividades desenvolvidas",
        lines: exemplos.length ? [texto, `Entre as ações registradas estão ${lista.format(exemplos.map(texto => texto.replace(/[.!?]+$/, "")))}.`] : [texto],
        depois: pdf => incluirFotosDoTecnico(pdf, relatorio, orcamentoFotos),
      });
      if (relatorio.observacoes?.trim()) secoes.push({ heading: "Observações da prestação", lines: [relatorio.observacoes] });
      if (relatorio.anexos.length) secoes.push({
        heading: "Anexos e evidências",
        lines: relatorio.anexos.map((anexo, indice) => `${indice + 1}. ${anexo.nome || "Anexo"} | Clique para abrir o anexo completo`),
        links: relatorio.anexos.map((_, indice) => new URL(caminhoAnexo(dados.competencia, relatorio.id, indice), request.url).href),
      });
      return secoes;
    }),
  ];

  const { nome, nomeEmpresarial, mei } = dados.consultor;
  const consultor = [`Consultor: ${nome}`, "Cargo: Consultor do Projeto"];
  if (nomeEmpresarial?.trim()) consultor.push(`Nome empresarial: ${nomeEmpresarial.trim()}`);
  const cnpj = (mei ?? "").replace(/\D/g, "");
  if (cnpj.length === 14) {
    consultor.push(`CNPJ: ${cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}`);
  }

  const pdf = await createPdf("Relatório compilado dos técnicos de campo", secoes, {
    logoBase64: PROJETO_LOGO_BASE64,
    identificacao: `Associação: ${dados.associacao}`,
    consultor,
    periodo,
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="relatorio-compilado-${dados.competencia}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
