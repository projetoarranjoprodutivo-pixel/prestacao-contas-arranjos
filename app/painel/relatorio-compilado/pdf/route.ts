import { incluirRegistrosFotograficos } from "./fotos";
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
  const resultado = await incluirRegistrosFotograficos(pdf, dados.relatorios);
  return new Response(new Uint8Array(resultado), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="relatorio-compilado-${dados.competencia}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
