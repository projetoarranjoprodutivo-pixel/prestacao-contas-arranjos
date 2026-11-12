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
  const objeto = await env.BUCKET.get(anexo.key, "arrayBuffer");
  if (!objeto) return new Response("Anexo não encontrado.", { status: 404 });
  const nome = anexo.nome || "anexo";
  const mime = anexo.tipo?.toLowerCase().trim();
  const assinatura = new Uint8Array(objeto, 0, Math.min(objeto.byteLength, 8));
  const pdf = assinatura.length >= 5 && new TextDecoder().decode(assinatura.slice(0, 5)) === "%PDF-";
  const imagem = mime === "image/jpeg" && assinatura[0] === 0xff && assinatura[1] === 0xd8 ? mime :
    mime === "image/png" && assinatura[0] === 0x89 && assinatura[1] === 0x50 && assinatura[2] === 0x4e && assinatura[3] === 0x47 ? mime : undefined;
  const tipo = pdf ? "application/pdf" : imagem;
  return new Response(objeto, { headers: {
    "Content-Type": tipo || "application/octet-stream",
    "Content-Disposition": `${tipo ? "inline" : "attachment"}; filename="anexo${pdf ? ".pdf" : ""}"; filename*=UTF-8''${encodeURIComponent(nome).replace(/['()*]/g, c => "%" + c.charCodeAt(0).toString(16))}`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  } });
}
