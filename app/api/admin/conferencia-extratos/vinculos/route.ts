import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { documentosAssociacao } from "@/db/schema";
import { getAdminUser } from "@/lib/admin";
import { numeroMonetario } from "@/lib/moeda";

const tabela = `CREATE TABLE IF NOT EXISTS vinculos_extrato_nota (
  associacao TEXT NOT NULL,
  extrato TEXT NOT NULL,
  lancamento TEXT NOT NULL,
  nota TEXT NOT NULL,
  centavos INTEGER NOT NULL CHECK (centavos > 0),
  PRIMARY KEY (associacao, extrato, lancamento)
)`;

function erro(message: string, status: number) {
  return Response.json({message}, {status});
}

export async function GET(request: Request) {
  if (!await getAdminUser()) return erro("Acesso restrito.", 403);
  const associacao = new URL(request.url).searchParams.get("associacao");
  if (!associacao) return erro("Selecione a associação.", 400);
  await env.DB.prepare(tabela).run();
  const dados = await env.DB.prepare("SELECT extrato, lancamento, nota, centavos FROM vinculos_extrato_nota WHERE associacao = ?").bind(associacao).all();
  return Response.json(dados.results, {headers: {"Cache-Control": "private, no-store"}});
}

type Arquivo = {key?: string; valor?: string};
function arquivos(json: string): Arquivo[] {
  try {
    const dados: unknown = JSON.parse(json);
    return Array.isArray(dados) ? dados.filter(item => item && typeof item.key === "string") : [];
  } catch { return []; }
}

export async function POST(request: Request) {
  if (!await getAdminUser()) return erro("Acesso restrito.", 403);
  const dados = await request.json().catch(() => null) as {
    associacao?: string; extrato?: string; lancamento?: string; nota?: string | null; centavos?: number;
  } | null;
  if (!dados) return erro("Vínculo inválido.", 400);
  const {associacao, extrato, lancamento, nota, centavos} = dados;
  if (typeof associacao !== "string" || !associacao || typeof extrato !== "string" || !extrato ||
      typeof lancamento !== "string" || !lancamento || lancamento.length > 8192) return erro("Vínculo inválido.", 400);

  const registros = await getDb().select({
    extratos: documentosAssociacao.extratosJson, notas: documentosAssociacao.notasFiscaisJson,
  }).from(documentosAssociacao).where(eq(documentosAssociacao.associacao, associacao));
  if (!registros.some(registro => arquivos(registro.extratos).some(item => item.key === extrato))) {
    return erro("Extrato não encontrado na associação.", 404);
  }

  await env.DB.prepare(tabela).run();
  if (nota === null) {
    await env.DB.prepare("DELETE FROM vinculos_extrato_nota WHERE associacao = ? AND extrato = ? AND lancamento = ?")
      .bind(associacao, extrato, lancamento).run();
    return Response.json({ok: true});
  }
  if (typeof nota !== "string" || typeof centavos !== "number" || !Number.isSafeInteger(centavos) || centavos <= 0) {
    return erro("Selecione uma nota e um lançamento válidos.", 400);
  }
  const documento = registros.flatMap(registro => arquivos(registro.notas)).find(item => item.key === nota);
  if (!documento) return erro("Nota não encontrada na associação.", 404);
  const limite = Math.round(numeroMonetario(documento.valor) * 100);
  if (!Number.isSafeInteger(limite) || limite <= 0) return erro("A nota precisa ter um valor cadastrado.", 400);

  const gravacao = await env.DB.prepare(`
    INSERT INTO vinculos_extrato_nota (associacao, extrato, lancamento, nota, centavos)
    SELECT ?, ?, ?, ?, ?
    WHERE ? >= ? + COALESCE((
      SELECT SUM(centavos) FROM vinculos_extrato_nota
      WHERE associacao = ? AND nota = ? AND NOT (extrato = ? AND lancamento = ?)
    ), 0)
    ON CONFLICT (associacao, extrato, lancamento)
    DO UPDATE SET nota = excluded.nota, centavos = excluded.centavos
  `).bind(associacao, extrato, lancamento, nota, centavos, limite, centavos, associacao, nota, extrato, lancamento).run();
  if (!gravacao.meta.changes) return erro("O lançamento ultrapassa o saldo da nota.", 409);
  return Response.json({ok: true});
}
