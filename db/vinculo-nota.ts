import { inArray, sql } from "drizzle-orm";
import { documentosAssociacao } from "./schema";

export function vinculoNotaNasCompetencias(competencias: string[]) {
  return sql`exists (
    select 1
    from json_each(case when json_valid(${documentosAssociacao.notasFiscaisJson})
      then ${documentosAssociacao.notasFiscaisJson} else '[]' end) as nota
    where ${inArray(sql`nota.value ->> '$.vinculoPrestacao.competencia'`, competencias)}
  )`;
}
