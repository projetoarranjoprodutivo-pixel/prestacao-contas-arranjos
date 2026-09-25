import { getAdminUser } from "@/lib/admin";
import { createPdf, PdfSection } from "@/lib/pdf";
import agricultores from "@/data/agricultores-iniciais.json";

export const runtime = "edge";

type AgricultorBase = { n: string; m: string; a: string };
const informado = (valor: string) => valor?.trim() || "NÃO INFORMADO";

export async function GET(request: Request) {
  if (!await getAdminUser()) return new Response("ACESSO RESTRITO", { status: 403 });

  const url = new URL(request.url);
  const filtroAssociacao = url.searchParams.get("associacao")?.trim() || "";
  const todos = agricultores as AgricultorBase[];
  const registros = filtroAssociacao
    ? todos.filter((item) => item.a === filtroAssociacao)
    : todos;

  if (!registros.length) {
    return new Response("NENHUM AGRICULTOR ENCONTRADO PARA A ASSOCIAÇÃO SELECIONADA.", { status: 404 });
  }

  const associacoes = [...new Set(registros.map((item) => informado(item.a)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
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
    const daAssociacao = registros.filter((item) => informado(item.a) === associacao);
    const municipios = [...new Set(daAssociacao.map((item) => informado(item.m)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    sections.push({
      heading: `${associacao} - RESUMO`,
      lines: [`TOTAL DE AGRICULTORES DA ASSOCIAÇÃO: ${daAssociacao.length.toLocaleString("pt-BR")}`],
    });
    for (const municipio of municipios) {
      const lista = daAssociacao
        .filter((item) => informado(item.m) === municipio)
        .sort((a, b) => a.n.localeCompare(b.n, "pt-BR"));
      sections.push({
        heading: `${associacao} - ${municipio} - ${lista.length} AGRICULTORES`,
        lines: lista.map((item, indice) =>
          `${String(indice + 1).padStart(3, "0")}. NOME: ${informado(item.n)} | MUNICÍPIO: ${informado(item.m)} | ASSOCIAÇÃO: ${informado(item.a)}`
        ),
      });
    }
  }

  const titulo = filtroAssociacao
    ? `CADASTRO DE AGRICULTORES - ${filtroAssociacao}`
    : "CADASTRO GERAL DE AGRICULTORES";
  const bytes = await createPdf(titulo, sections);
  const sufixo = (filtroAssociacao || "todas-as-associacoes").replace(/[^a-zA-Z0-9_-]/g, "-");
  return new Response(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="cadastro-agricultores-${sufixo}.pdf"`,
    },
  });
}
