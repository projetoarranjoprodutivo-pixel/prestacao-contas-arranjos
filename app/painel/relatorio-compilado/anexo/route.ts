import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { dadosRelatorioCompilado } from "../dados";

export const runtime = "edge";

export async function GET(request: Request) {
  const usuario = await getChatGPTUser();
  if (!usuario) return new Response("Entre para acessar o anexo.", { status: 401 });
  const params = new URL(request.url).searchParams;
  const id = Number(params.get("id"));
  const indice = Number(params.get("indice") ?? NaN);
  if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(indice) || indice < 0) {
    return new Response("Anexo inválido.", { status: 400 });
  }
  const dados = await dadosRelatorioCompilado(usuario, params.get("competencia"), id);
  if (!dados) return new Response("Acesso restrito.", { status: 403 });
  const anexo = dados.relatorios[0]?.anexos[indice];
  if (!anexo?.key) return new Response("Anexo não encontrado.", { status: 404 });
  if (!env.BUCKET) return new Response("Armazenamento indisponível.", { status: 503 });
  const objeto = await env.BUCKET.get(anexo.key);
  if (!objeto) return new Response("Anexo não encontrado.", { status: 404 });
  return new Response(objeto.body, { headers: {
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(anexo.nome || "anexo").replace(/'/g, "%27")}`,
    "Cache-Control": "private, no-store",
  } });
}
