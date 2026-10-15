import { env } from "cloudflare:workers";
import { getGestorMudasUser } from "@/lib/admin";
import { getDb } from "@/db";
import { documentosAssociacao } from "@/db/schema";

export const runtime = "edge";

export async function GET(request: Request) {
  if (!await getGestorMudasUser()) return new Response("ACESSO NEGADO.", { status: 403 });
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!key.startsWith("associacoes-financeiro/")) return new Response("ARQUIVO INVÁLIDO.", { status: 400 });
  const documentos = await getDb().select().from(documentosAssociacao);
  const autorizado = documentos.some(documento => {
    try {
      const notas = JSON.parse(documento.notasFiscaisJson || "[]");
      return Array.isArray(notas) && notas.some(nota => nota.key === key && /MUDA|SEMENTE|PLANTULA/.test(`${nota.nome || ""} ${nota.descricao || ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()));
    } catch { return false; }
  });
  if (!autorizado) return new Response("ACESSO NEGADO.", { status: 403 });
  const arquivo = await env.BUCKET.get(key, "stream");
  if (!arquivo) return new Response("ARQUIVO NÃO ENCONTRADO.", { status: 404 });
  const nome = key.split("/").pop() || "nota-fiscal";
  const tipo = nome.toLowerCase().endsWith(".pdf") ? "application/pdf" : nome.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  return new Response(arquivo, { headers: { "Content-Type": tipo, "Content-Disposition": `inline; filename="${nome.replace(/["\r\n]/g, "")}"`, "Cache-Control": "private, max-age=300" } });
}
