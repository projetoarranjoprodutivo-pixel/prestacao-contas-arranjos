import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { prestacoes } from "@/db/schema";
import { getAdminUser } from "@/lib/admin";

export const runtime = "edge";

type Anexo = { key?: string; nome?: string; tipo?: string };
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

function escaparHtml(texto: string) {
  return texto.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export async function GET(request: Request) {
  if (!await getAdminUser()) return new Response("Acesso restrito.", { status: 403, headers });

  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) return new Response("Prestação inválida.", { status: 400, headers });

  const registro = await getDb().query.prestacoes.findFirst({
    columns: { competencia: true, anexosJson: true },
    where: eq(prestacoes.id, id),
  });
  if (!registro) return new Response("Prestação não encontrada.", { status: 404, headers });

  let anexos: Anexo[] = [];
  try {
    const dados: unknown = JSON.parse(registro.anexosJson || "[]");
    if (Array.isArray(dados)) anexos = dados;
  } catch {
    return new Response("Não foi possível ler a lista de anexos.", { status: 500, headers });
  }

  const indice = searchParams.get("arquivo");
  if (indice !== null) {
    const anexo = /^\d+$/.test(indice) ? anexos[Number(indice)] : undefined;
    if (typeof anexo?.key !== "string" || !anexo.key) {
      return new Response("Anexo não encontrado.", { status: 404, headers });
    }

    const arquivo = await env.BUCKET?.get(anexo.key, "stream");
    if (!arquivo) return new Response("Arquivo original indisponível.", { status: 404, headers });

    const tipo = anexo.tipo === "application/pdf" || anexo.tipo === "image/jpeg" || anexo.tipo === "image/png"
      ? anexo.tipo
      : "application/octet-stream";
    const disposicao = searchParams.get("visualizar") === "1" && tipo !== "application/octet-stream" ? "inline" : "attachment";
    const nome = (typeof anexo.nome === "string" ? anexo.nome : "anexo").replace(/[\r\n]/g, "").toWellFormed();
    const nomeCodificado = encodeURIComponent(nome).replace(/['()*]/g, c => "%" + c.charCodeAt(0).toString(16));
    return new Response(arquivo, {
      headers: {
        ...headers,
        "Content-Type": tipo,
        "Content-Disposition": `${disposicao}; filename*=UTF-8''${nomeCodificado}`,
      },
    });
  }

  const itens = anexos.flatMap((anexo, index) => {
    if (typeof anexo?.key !== "string" || !anexo.key) return [];
    const url = `?id=${id}&amp;arquivo=${index}`;
    const nome = escaparHtml(typeof anexo.nome === "string" && anexo.nome ? anexo.nome : `Anexo ${index + 1}`);
    return [`<li><strong>${nome}</strong> <a href="${url}&amp;visualizar=1" target="_blank" rel="noopener">Abrir</a> <a href="${url}">Baixar</a></li>`];
  });
  const lista = itens.length ? `<ul>${itens.join("")}</ul>` : "<p>Esta prestação não tem anexos disponíveis.</p>";
  return new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Anexos originais</title><style>body{font:1rem system-ui;margin:2rem auto;padding:0 1rem;max-width:54rem;color:#183a2e}li{margin:1rem 0}a{margin-left:.5rem}</style><main><h1>Anexos originais</h1><p>Competência ${escaparHtml(registro.competencia)}</p>${lista}</main></html>`, {
    headers: { ...headers, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'" },
  });
}
