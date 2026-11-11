import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { associacoes } from "@/db/schema";
import { getAdminUser } from "@/lib/admin";
import { baseFomento, chaveOrcamentoMudas } from "@/lib/fomento-aderes";
import { numeroMonetario } from "@/lib/moeda";

export const runtime = "edge";

async function buscarChave(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const a = await getDb().query.associacoes.findFirst({
    where: and(eq(associacoes.id, id), eq(associacoes.ativo, true)),
  });
  const base = a && baseFomento(a.cnpj, a.documentosJson);
  return a && base ? chaveOrcamentoMudas(a.id, base.sha256) : null;
}

export async function GET(request: Request) {
  if (!await getAdminUser()) return Response.json({ message: "Acesso restrito." }, { status: 403 });
  if (!env.BUCKET) return Response.json({ message: "Armazenamento indisponível." }, { status: 503 });
  const chave = await buscarChave(Number(new URL(request.url).searchParams.get("associacaoId")));
  if (!chave) return Response.json({ message: "Associação sem termo de fomento conferido." }, { status: 404 });
  const salvo = await env.BUCKET.get(chave, "text");
  return Response.json({ valor: salvo === null ? null : Number(salvo) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: Request) {
  if (!await getAdminUser()) return Response.json({ message: "Acesso restrito." }, { status: 403 });
  if (!env.BUCKET) return Response.json({ message: "Armazenamento indisponível." }, { status: 503 });
  const dados = await request.json().catch(() => null) as { associacaoId?: number; valor?: string } | null;
  const valor = numeroMonetario(dados?.valor);
  if (!Number.isFinite(valor) || valor < 0 || valor > 1_000_000_000 ||
      Math.abs(valor * 100 - Math.round(valor * 100)) > 0.0001) {
    return Response.json({ message: "Informe um valor em reais com até duas casas decimais." }, { status: 400 });
  }
  const chave = await buscarChave(Number(dados?.associacaoId));
  if (!chave) return Response.json({ message: "Associação sem termo de fomento conferido." }, { status: 404 });
  await env.BUCKET.put(chave, valor.toFixed(2));
  return Response.json({ message: "Valor disponibilizado salvo." });
}
