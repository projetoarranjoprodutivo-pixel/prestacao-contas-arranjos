import { env } from "cloudflare:workers";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { associacoes, colaboradores, documentosAssociacao } from "@/db/schema";
import { getAderesOrAdminUser } from "@/lib/admin";
import { categoriaDaNota } from "@/lib/classificacao-notas";
import { normalizarNomeAssociacao } from "@/lib/nome-associacao";
import { associacoesDoColaborador } from "@/lib/notas-servico";
import { ativoNaCompetencia } from "@/lib/vinculo-colaborador";

export const runtime = "edge";

type Nota = Parameters<typeof categoriaDaNota>[0] & { key?: string; sha256?: string; vinculoPrestacao?: unknown; competencia?: string; numeroNota?: string; cnpjPrestador?: string; dataEmissao?: string };
const responder = (message: string, status = 200) => Response.json({ message }, { status });

export async function POST(request: Request) {
  const usuario = await getAderesOrAdminUser();
  if (!usuario) return responder("ACESSO NEGADO.", 403);

  try {
    const dados = await request.json().catch(() => null) as {
      key?: string;
      associacaoOrigem?: string;
      associacaoDestino?: string;
      colaboradorId?: number;
      competencia?: string;
    } | null;
    if (!dados) return responder("TRANSFERÊNCIA INVÁLIDA.", 400);
    const { key, associacaoOrigem, associacaoDestino, colaboradorId, competencia } = dados;
    if (typeof key !== "string" || !key ||
        typeof associacaoOrigem !== "string" || !associacaoOrigem ||
        typeof associacaoDestino !== "string" || !associacaoDestino ||
        normalizarNomeAssociacao(associacaoOrigem) === normalizarNomeAssociacao(associacaoDestino) ||
        typeof competencia !== "string" || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(competencia)) {
      return responder("SELECIONE OUTRA ASSOCIAÇÃO E A COMPETÊNCIA.", 400);
    }

    const db = getDb();
    const [destino, colaborador, registros] = await Promise.all([
      db.query.associacoes.findFirst({
        columns: { nome: true },
        where: and(eq(associacoes.nome, associacaoDestino), eq(associacoes.ativo, true)),
      }),
      typeof colaboradorId === "number" && Number.isSafeInteger(colaboradorId) && colaboradorId > 0 ? db.query.colaboradores.findFirst({
        columns: { associacao: true, associacoesJson: true, dataAdmissao: true, dataSaida: true },
        where: eq(colaboradores.id, colaboradorId),
      }) : null,
      db.select({ id: documentosAssociacao.id, notas: documentosAssociacao.notasFiscaisJson })
        .from(documentosAssociacao)
        .where(and(eq(documentosAssociacao.associacao, associacaoOrigem),
          sql`instr(${documentosAssociacao.notasFiscaisJson}, ${key}) > 0`)),
    ]);

    if (!destino) return responder("ASSOCIAÇÃO DE DESTINO INATIVA OU NÃO ENCONTRADA.", 422);

    for (const registro of registros) {
      const notas = JSON.parse(registro.notas) as Nota[];
      const nota = notas.find(item => item?.key === key);
      if (!nota) continue;
      const categoria = categoriaDaNota(nota);
      if (categoria === "outras") return responder("SELECIONE UMA NOTA DE SERVIÇO OU DE COMPRA DE MUDAS.", 422);
      if (categoria === "servico" && (!colaborador || !ativoNaCompetencia(colaborador, competencia) ||
          !associacoesDoColaborador(colaborador).some(nome => normalizarNomeAssociacao(nome) === normalizarNomeAssociacao(destino.nome)))) {
        return responder("O PRESTADOR DEVE ESTAR VINCULADO AO DESTINO E ATIVO NA COMPETÊNCIA.", 422);
      }

      const banco = env.DB;
      if (!banco) return responder("BANCO DE DADOS INDISPONÍVEL.", 500);
      const transferida = { ...nota, categoriaNota: categoria };
      if (categoria === "servico") transferida.vinculoPrestacao = { colaboradorId, competencia };
      else {
        delete transferida.vinculoPrestacao;
        transferida.competencia = competencia;
      }
      const restantes = notas.filter(item => item?.key !== key);
      const atualizadoEm = new Date().toISOString();

      const numeroFiscal = String(nota.numeroNota || "").replace(/\D/g, "").replace(/^0+/, "");
      const cnpjEmitente = String(nota.cnpjPrestador || "").replace(/\D/g, "");
      const identidadeFiscal = categoria === "mudas" && numeroFiscal && cnpjEmitente.length === 14 && nota.dataEmissao ? 1 : 0;

      // O lote é atômico. A origem só é removida se a instrução anterior inseriu a nota.
      const [insercao, remocao] = await banco.batch([
        banco.prepare(`
          INSERT INTO documentos_associacao (auth_user_id, associacao, competencia, notas_fiscais_json, atualizado_em)
          SELECT ?, ?, ?, json_array(json(?)), ?
          WHERE EXISTS (SELECT 1 FROM documentos_associacao WHERE id = ? AND notas_fiscais_json = ?)
          AND NOT EXISTS (
            SELECT 1 FROM documentos_associacao d, json_each(d.notas_fiscais_json) AS n
            WHERE d.associacao = ? AND (
              n.value ->> '$.key' = ? OR (? <> '' AND n.value ->> '$.sha256' = ?)
              OR (? = 1
                AND ltrim(replace(n.value ->> '$.numeroNota', '.', ''), '0') = ?
                AND replace(replace(replace(n.value ->> '$.cnpjPrestador', '.', ''), '/', ''), '-', '') = ?
                AND n.value ->> '$.dataEmissao' = ?)
            )
          )
          ON CONFLICT (associacao, competencia) DO UPDATE SET
            notas_fiscais_json = json_insert(documentos_associacao.notas_fiscais_json, '$[#]', json(?)),
            atualizado_em = excluded.atualizado_em
          WHERE NOT EXISTS (
            SELECT 1 FROM json_each(documentos_associacao.notas_fiscais_json) AS nota
            WHERE nota.value ->> '$.key' = ?
          )
        `).bind(usuario.userId, destino.nome, competencia, JSON.stringify(transferida), atualizadoEm,
          registro.id, registro.notas, destino.nome, key, nota.sha256 || "", nota.sha256 || "", identidadeFiscal, numeroFiscal, cnpjEmitente, nota.dataEmissao || "", JSON.stringify(transferida), key),
        banco.prepare(`
          UPDATE documentos_associacao SET notas_fiscais_json = ?, atualizado_em = ?
          WHERE id = ? AND notas_fiscais_json = ? AND changes() = 1
        `).bind(JSON.stringify(restantes), atualizadoEm, registro.id, registro.notas),
      ]);

      if (insercao.meta.changes !== 1 || remocao.meta.changes !== 1) {
        return responder("A NOTA JÁ ESTÁ NO DESTINO OU FOI ALTERADA. ATUALIZE A PÁGINA E CONFIRA.", 409);
      }
      return responder("NOTA TRANSFERIDA COM SUCESSO.");
    }
    return responder("NOTA NÃO ENCONTRADA NA ASSOCIAÇÃO DE ORIGEM. ATUALIZE A PÁGINA.", 404);
  } catch (erro) {
    console.error("transferir_nota", erro);
    return responder("NÃO FOI POSSÍVEL TRANSFERIR A NOTA.", 500);
  }
}
