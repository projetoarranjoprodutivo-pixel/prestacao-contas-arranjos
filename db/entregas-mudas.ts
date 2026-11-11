import { inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { prestacoes } from "./schema";
import { RESPONSAVEL_ENTREGAS_OFICIAIS } from "@/lib/entregas-mudas";

// Preserve o índice original para edição dos lançamentos administrativos.
export function listarAtividadesDeMudasOficiais(competencias?: string[]) {
  return getDb().all<{
    prestacaoId: number;
    atividadeIndex: number;
    competencia: string;
    authUserId: string;
    associacao: string;
    atividadeJson: string;
  }>(sql`
    SELECT prestacoes.id AS prestacaoId, a.key AS atividadeIndex, prestacoes.competencia, prestacoes.auth_user_id AS authUserId, prestacoes.associacao,
      json_remove(a.value, '$.assinaturaProdutor', '$.assinaturaTecnico') AS atividadeJson
    FROM prestacoes, json_each(CASE
      WHEN (prestacoes.auth_user_id = ${RESPONSAVEL_ENTREGAS_OFICIAIS}
        OR instr(prestacoes.atividades_json, '"agendaEntregaId"') > 0)
        AND json_valid(prestacoes.atividades_json)
      THEN prestacoes.atividades_json ELSE '[]' END) a
    WHERE a.type = 'object' AND (
      prestacoes.auth_user_id = ${RESPONSAVEL_ENTREGAS_OFICIAIS}
      OR NULLIF(json_extract(a.value, '$.agendaEntregaId'), '') IS NOT NULL
    ) ${competencias?.length ? sql`AND ${inArray(prestacoes.competencia, competencias)}` : sql``}
  `);
}
