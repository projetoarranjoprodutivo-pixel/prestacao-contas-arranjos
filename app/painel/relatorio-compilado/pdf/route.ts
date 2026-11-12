import { getChatGPTUser } from "@/app/chatgpt-auth";
import { createPdf, type PdfSection } from "@/lib/pdf";
import { PROJETO_LOGO_BASE64 } from "@/lib/pdf-assets";
import { dadosRelatorioCompilado, horas } from "../dados";

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
  const secoes: PdfSection[] = [
    { heading: "Identificação", lines: [`Associação: ${dados.associacao}`, `Competência: ${periodo}`] },
    { heading: "Resumo da execução", lines: [
      `Relatórios consolidados: ${dados.relatorios.length}`,
      `Atividades realizadas: ${dados.atividades}`,
      `Carga horária: ${horas(dados.minutos)} horas`,
    ] },
    ...dados.relatorios.map(relatorio => ({
      heading: relatorio.tecnico,
      lines: relatorio.grupos.length ? relatorio.grupos.map(grupo =>
        `${grupo.municipio} | ${grupo.tipo} | ATIVIDADES: ${grupo.quantidade} | CARGA HORÁRIA: ${horas(grupo.minutos)} H`,
      ) : ["Nenhuma atividade realizada informada."],
    })),
  ];

  const pdf = await createPdf("Relatório compilado dos técnicos de campo", secoes, {
    logoBase64: PROJETO_LOGO_BASE64,
    identificacao: `Associação: ${dados.associacao}`,
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
