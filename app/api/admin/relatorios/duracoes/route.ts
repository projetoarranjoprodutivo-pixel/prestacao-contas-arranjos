import { and, eq, gt, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { planosTrabalho, prestacoes } from "@/db/schema";
import { getAdminUser } from "@/lib/admin";
import { apurarDuracoesRelatorio, preencherDuracao, minutosDaAtividade, unidadeConfirmadaNoPlano, type DuracaoAtividade } from "@/lib/duracao-relatorios";

export const runtime = "edge";

export async function POST(request: Request) {
 if (!await getAdminUser()) return Response.json({ message: "ACESSO RESTRITO." }, { status: 403 });
 const entrada = await request.json().catch(() => null) as { cursor?: number; somenteConferir?: boolean } | null;
 const cursor = entrada?.cursor;
 if (typeof cursor !== "number" || !Number.isSafeInteger(cursor) || cursor < 0) {
  return Response.json({ message: "POSIÇÃO DE CONSULTA INVÁLIDA." }, { status: 400 });
 }

 try {
  const db = getDb();
  const limite = 25;
  const registros = await db.select({
   id: prestacoes.id, atividadesJson: prestacoes.atividadesJson, atualizadoEm: prestacoes.atualizadoEm,
   totalMinutos: prestacoes.totalMinutos, status: prestacoes.status, agendaJson: planosTrabalho.agendaJson,
  }).from(prestacoes).leftJoin(planosTrabalho, and(
    eq(planosTrabalho.authUserId, prestacoes.authUserId),eq(planosTrabalho.competencia, prestacoes.competencia),
    eq(planosTrabalho.associacao, prestacoes.associacao),eq(planosTrabalho.status, "importado"),
   )).where(and(gt(prestacoes.id, cursor), ne(prestacoes.authUserId, "admin-importacao-mudas-2026")))
   .orderBy(prestacoes.id).limit(limite);
  let relatorios = 0, atividades = 0, conflitos = 0, ambiguas = 0, candidatos = 0;
  const alteracoes = registros.flatMap(registro => {
   let dados: unknown;
   try { dados = JSON.parse(registro.atividadesJson); } catch { return []; }
   if (!Array.isArray(dados)) return [];
   type Item = DuracaoAtividade & { municipio?: string; tipoAtividade?: string };
   const originais = dados.filter((item): item is Item => !!item && typeof item === "object");
   const unidade = unidadeConfirmadaNoPlano(originais, registro.agendaJson);
   let quantidade = 0;
   const novas = dados.map((a: Item | null) => {
    if (!a || typeof a !== "object") return a;
    const preenchida = preencherDuracao(a);
    if (preenchida !== a) { quantidade++; return preenchida; }
    const valor = minutosDaAtividade(a);
    if (a.unidadeDuracao || !valor) return a;
    if (!unidade) { ambiguas++; return a; }
    quantidade++;
    return { ...a, unidadeDuracao: unidade };
   });
   candidatos += quantidade;
   if (!quantidade || entrada?.somenteConferir) return [];
   const apuracao = apurarDuracoesRelatorio(novas.filter((item): item is Item => !!item && typeof item === "object"),
    registro.totalMinutos, registro.agendaJson, registro.status === "importado" || originais.some(item => !item.unidadeDuracao && minutosDaAtividade(item) > 0));
   const totalMinutos = Math.round(apuracao.minutos);
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
  return Response.json({ examinados: registros.length, relatorios, atividades, conflitos, ambiguas, candidatos,
   proximo: registros.length === limite ? registros.at(-1)?.id : null });
 } catch (erro) {
  console.error("padronizar_duracao_relatorios", erro);
  return Response.json({ message: "NÃO FOI POSSÍVEL CONCLUIR ESTE LOTE. EXECUTE A VARREDURA NOVAMENTE." }, { status: 500 });
 }
}
