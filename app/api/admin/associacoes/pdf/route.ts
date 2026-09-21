import { getDb } from "@/db";
import { garantirAssociacoesCompletas } from "@/db/bootstrap";
import { associacoes } from "@/db/schema";
import { getAdminUser } from "@/lib/admin";
import { createPdf } from "@/lib/pdf";
import { asc, eq, inArray } from "drizzle-orm";

export const runtime = "edge";

type Documento = { nome?: string };

function lista(json: string | null) {
  try { const valor = JSON.parse(json || "[]"); return Array.isArray(valor) ? valor : []; }
  catch { return []; }
}

function informar(valor: string | null | undefined) {
  return valor?.trim() || "Não informado";
}

function formatarNumero(valor: string | null | undefined, tipo: "cnpj" | "cpf" | "cep") {
  const numeros = (valor || "").replace(/\D/g, "");
  if (tipo === "cnpj" && numeros.length === 14) return numeros.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (tipo === "cpf" && numeros.length === 11) return numeros.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  if (tipo === "cep" && numeros.length === 8) return numeros.replace(/^(\d{5})(\d{3})$/, "$1-$2");
  return informar(valor);
}

export async function GET(request: Request) {
  if (!await getAdminUser()) return new Response("Acesso restrito", { status: 403 });
  await garantirAssociacoesCompletas();

  const url = new URL(request.url);
  const todas = url.searchParams.get("todas") === "1";
  const ids = [...new Set((url.searchParams.get("ids") || "").split(",").map(Number).filter(id => Number.isInteger(id) && id > 0))];
  if (!todas && !ids.length) return new Response("Selecione ao menos uma associação.", { status: 400 });

  const db = getDb();
  const registros = await db.select().from(associacoes)
    .where(todas ? eq(associacoes.ativo, true) : inArray(associacoes.id, ids))
    .orderBy(asc(associacoes.nome));
  if (!registros.length) return new Response("Nenhuma associação encontrada.", { status: 404 });

  const secoes = registros.flatMap((associacao, indice) => {
    const municipios = lista(associacao.municipiosJson) as string[];
    const documentos = lista(associacao.documentosJson) as Documento[];
    return [
      {
        heading: `${indice + 1}. ${associacao.nome}`,
        lines: [
          `Razão social: ${informar(associacao.razaoSocial)}`,
          `CNPJ: ${formatarNumero(associacao.cnpj, "cnpj")}`,
          `Endereço: ${informar(associacao.endereco)}, nº ${informar(associacao.numero)}`,
          `Bairro: ${informar(associacao.bairro)}`,
          `Município/UF: ${informar(associacao.municipio)}/${informar(associacao.uf)}`,
          `CEP: ${formatarNumero(associacao.cep, "cep")}`,
          `Telefone: ${informar(associacao.telefone)} | Celular: ${informar(associacao.celular)}`,
          `E-mail: ${informar(associacao.email)}`,
          `Municípios atendidos: ${municipios.length ? municipios.join(", ") : "Não informados"}`,
        ],
      },
      {
        heading: "DADOS DO PRESIDENTE",
        lines: [
          `Nome: ${informar(associacao.presidenteNome)}`,
          `CPF: ${formatarNumero(associacao.presidenteCpf, "cpf")}`,
          `Endereço: ${informar(associacao.presidenteEndereco)}, nº ${informar(associacao.presidenteNumero)}`,
          `Bairro: ${informar(associacao.presidenteBairro)}`,
          `Município/UF: ${informar(associacao.presidenteMunicipio)}/${informar(associacao.presidenteUf)}`,
          `CEP: ${formatarNumero(associacao.presidenteCep, "cep")}`,
          `E-mail: ${informar(associacao.presidenteEmail)}`,
        ],
      },
      {
        heading: "DOCUMENTOS CADASTRADOS",
        lines: documentos.length ? documentos.map((documento, item) => `${item + 1}. ${informar(documento.nome)}`) : ["Nenhum documento cadastrado."],
      },
    ];
  });

  const pdf = createPdf("RELATÓRIO CADASTRAL DE ASSOCIAÇÕES - ARRANJOS PRODUTIVOS", secoes);
  return new Response(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="associacoes-${todas ? "todas" : "selecionadas"}.pdf"`,
    },
  });
}
