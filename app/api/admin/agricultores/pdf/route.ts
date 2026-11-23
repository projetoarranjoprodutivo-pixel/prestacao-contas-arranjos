import { getAdminUser } from "@/lib/admin";
import { createPdf, PdfSection } from "@/lib/pdf";
import { filtrarAgricultores, filtrosCadastroAgricultores, listarAgricultores } from "@/db/agricultores";

export const runtime = "edge";

const informado = (valor: string) => valor?.trim() || "NÃO INFORMADO";

export async function GET(request: Request) {
  if (!await getAdminUser()) return new Response("ACESSO RESTRITO", { status: 403 });

  const url = new URL(request.url);
  const filtros = filtrosCadastroAgricultores(url.searchParams.get("associacao"), url.searchParams.get("municipio"));
  const registros = filtrarAgricultores(await listarAgricultores(), filtros);
  const nomeDoMunicipio = filtros.municipio ? registros[0]?.municipio : undefined;

  if (!registros.length) {
    return new Response("NENHUM AGRICULTOR ENCONTRADO PARA OS FILTROS SELECIONADOS.", { status: 404 });
  }

  const associacoes = [...new Set(registros.map((item) => informado(item.associacao)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const sections: PdfSection[] = [{
    heading: "RESUMO DO CADASTRO",
    lines: [
      `TOTAL DE AGRICULTORES: ${registros.length.toLocaleString("pt-BR")}`,
      `ASSOCIAÇÃO: ${filtros.associacao || "TODAS AS ASSOCIAÇÕES"}`,
      `MUNICÍPIO: ${nomeDoMunicipio || "TODOS OS MUNICÍPIOS"}`,
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
        .filter((item) => informado(item.municipio) === municipio);
      sections.push({
        heading: `${associacao} - ${municipio} - ${lista.length} AGRICULTORES`,
        lines: lista.map((item, indice) =>
          `${String(indice + 1).padStart(3, "0")}. NOME: ${informado(item.nome)} | MUNICÍPIO: ${informado(item.municipio)} | ASSOCIAÇÃO: ${informado(item.associacao)} | CELULAR: ${informado(item.celular)}`
        ),
      });
    }
  }

  const escopo = [filtros.associacao, nomeDoMunicipio].filter(Boolean).join(" - ");
  const titulo = escopo ? `CADASTRO DE AGRICULTORES - ${escopo}` : "CADASTRO GERAL DE AGRICULTORES";
  const bytes = await createPdf(titulo, sections);
  const sufixo = (escopo || "todas-as-associacoes").replace(/[^a-zA-Z0-9_-]/g, "-");
  const disposicao = url.searchParams.get("visualizar") === "1" ? "inline" : "attachment";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/pdf",
      "cache-control": "private, no-store",
      "content-disposition": `${disposicao}; filename="cadastro-agricultores-${sufixo}.pdf"`,
    },
  });
}
