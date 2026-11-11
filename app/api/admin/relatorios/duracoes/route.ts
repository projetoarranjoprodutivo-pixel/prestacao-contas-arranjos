import { and, eq, gt, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { prestacoes } from "@/db/schema";
import { getAdminUser } from "@/lib/admin";
import { preencherDuracao, minutosDaAtividade, type DuracaoAtividade } from "@/lib/duracao-relatorios";

export const runtime = "edge";

export async function POST(request: Request) {
 if (!await getAdminUser()) return Response.json({ message: "ACESSO RESTRITO." }, { status: 403 });
 const entrada = await request.json().catch(() => null) as { cursor?: number } | null;
 const cursor = entrada?.cursor;
 if (typeof cursor !== "number" || !Number.isSafeInteger(cursor) || cursor < 0) {
  return Response.json({ message: "POSIÇÃO DE CONSULTA INVÁLIDA." }, { status: 400 });
 }

 try {
  const db = getDb();
  const limite = 25;
  const registros = await db.select({
   id: prestacoes.id, atividadesJson: prestacoes.atividadesJson, atualizadoEm: prestacoes.atualizadoEm,
  }).from(prestacoes).where(and(gt(prestacoes.id, cursor), ne(prestacoes.authUserId, "admin-importacao-mudas-2026")))
   .orderBy(prestacoes.id).limit(limite);
  let relatorios = 0, atividades = 0, conflitos = 0;
  const alteracoes = registros.flatMap(registro => {
   let dados: unknown;
   try { dados = JSON.parse(registro.atividadesJson); } catch { return []; }
   if (!Array.isArray(dados)) return [];
   let quantidade = 0;
   const novas = dados.map((a: DuracaoAtividade | null) => {
    if (!a || typeof a !== "object") return a;
    const nova = preencherDuracao(a);
    if (nova !== a) quantidade++;
    return nova;
   });
   if (!quantidade) return [];
   const totalMinutos = Math.round(novas.reduce((total, a) =>
    total + (a && typeof a === "object" ? minutosDaAtividade(a) : 0), 0));
   return [{ quantidade, gravar: db.update(prestacoes).set({
    atividadesJson: JSON.stringify(novas), totalMinutos, atualizadoEm: new Date().toISOString(),
   }).where(and(eq(prestacoes.id, registro.id), eq(prestacoes.atividadesJson, registro.atividadesJson),
    eq(prestacoes.atualizadoEm, registro.atualizadoEm))).returning({ id: prestacoes.id }) }];
  });
  const [primeira, ...restantes] = alteracoes;
  if (primeira) {
   const resultados = await db.batch([primeira.gravar, ...restantes.map(a => a.gravar)]);
   resultados.forEach((resultado, i) => {
    if (resultado.length) { relatorios++; atividades += alteracoes[i].quantidade; }
    else conflitos++;
   });
  }
  return Response.json({ examinados: registros.length, relatorios, atividades, conflitos,
   proximo: registros.length === limite ? registros.at(-1)?.id : null });
 } catch (erro) {
  console.error("padronizar_duracao_relatorios", erro);
  return Response.json({ message: "NÃO FOI POSSÍVEL CONCLUIR ESTE LOTE. EXECUTE A VARREDURA NOVAMENTE." }, { status: 500 });
 }
}
