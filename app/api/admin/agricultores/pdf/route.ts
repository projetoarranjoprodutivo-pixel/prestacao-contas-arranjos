import { getAdminUser } from "@/lib/admin";
import { createPdf, PdfSection } from "@/lib/pdf";
import { listarAgricultores } from "@/db/agricultores";
import { normalizarNomeAssociacao } from "@/lib/nome-associacao";

export const runtime = "edge";

const informado = (valor: string) => valor?.trim() || "NÃO INFORMADO";

export async function GET(request: Request) {
  if (!await getAdminUser()) return new Response("ACESSO RESTRITO", { status: 403 });

  const url = new URL(request.url);
  const filtroAssociacao = url.searchParams.get("associacao")?.trim() || "";
  const todos = await listarAgricultores();
  const registros = filtroAssociacao
    ? todos.filter((item) => item.associacao === normalizarNomeAssociacao(filtroAssociacao))
    : todos;

  if (!registros.length) {
    return new Response("NENHUM AGRICULTOR ENCONTRADO PARA A ASSOCIAÇÃO SELECIONADA.", { status: 404 });
  }

  const associacoes = [...new Set(registros.map((item) => informado(item.associacao)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const sections: PdfSection[] = [{
    heading: "RESUMO DO CADASTRO",
    lines: [
      `TOTAL DE AGRICULTORES: ${registros.length.toLocaleString("pt-BR")}`,
      `ASSOCIAÇÃO: ${filtroAssociacao || "TODAS AS ASSOCIAÇÕES"}`,
      `TOTAL DE ASSOCIAÇÕES: ${associacoes.length}`,
      "ORIGEM: LISTA CONSOLIDADA DE PRODUTORES DO PROJETO ARRANJOS PRODUTIVOS",
    ],
  }];

  for (const associacao of associacoes) {
    const daAssociacao = registros.filter((item) => informado(item.associacao) === associacao);
    const municipios = [...new Set(daAssociacao.map((item) => informado(item.municipio)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    sections.push({
      heading: `${associacao} - RESUMO`,
      lines: [`TOTAL DE AGRICULTORES DA ASSOCIAÇÃO: ${daAssociacao.length.toLocaleString("pt-BR")}`],
    });
    for (const municipio of municipios) {
      const lista = daAssociacao
        .filter((item) => informado(item.municipio) === municipio)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      sections.push({
        heading: `${associacao} - ${municipio} - ${lista.length} AGRICULTORES`,
        lines: lista.map((item, indice) =>
          `${String(indice + 1).padStart(3, "0")}. NOME: ${informado(item.nome)} | MUNICÍPIO: ${informado(item.municipio)} | ASSOCIAÇÃO: ${informado(item.associacao)}`
        ),
      });
    }
  }

  const titulo = filtroAssociacao
    ? `CADASTRO DE AGRICULTORES - ${filtroAssociacao}`
    : "CADASTRO GERAL DE AGRICULTORES";
  const bytes = await createPdf(titulo, sections);
  const sufixo = (filtroAssociacao || "todas-as-associacoes").replace(/[^a-zA-Z0-9_-]/g, "-");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="cadastro-agricultores-${sufixo}.pdf"`,
    },
  });
}
