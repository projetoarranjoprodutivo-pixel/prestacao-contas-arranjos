import {valorMonetarioDecimal} from "@/lib/moeda";
import { and, eq } from "drizzle-orm";
import { getGestorMudasUser } from "@/lib/admin";
import { getDb } from "@/db";
import { documentosAssociacao } from "@/db/schema";
export const runtime = "edge";
export async function POST(request: Request) {
  if (!await getGestorMudasUser()) return Response.json({message:"ACESSO NEGADO."},{status:403});
  try {
    const dados = await request.json() as Record<string, unknown>;
    const id = Number(dados.documentoId), key = String(dados.key || ""), acao = dados.acao;
    if (!Number.isInteger(id) || id <= 0 || !key || !["editar","excluir"].includes(String(acao))) return Response.json({message:"DADOS INVÁLIDOS."},{status:400});
    const db = getDb();
    const registro = await db.query.documentosAssociacao.findFirst({where:eq(documentosAssociacao.id,id)});
    if (!registro) return Response.json({message:"REGISTRO NÃO ENCONTRADO."},{status:404});
    const notas = JSON.parse(registro.notasFiscaisJson) as Array<Record<string, unknown>>;
    const indice = notas.findIndex(nota => nota.key === key);
    if (indice < 0) return Response.json({message:"NOTA NÃO ENCONTRADA."},{status:404});
    if (acao === "excluir") notas.splice(indice,1);
    else {
      const campos = Object.fromEntries(["numeroNota","descricao","quantidade","valor","dataEmissao"].map(campo => [campo,String(dados[campo] || "").trim()]));
      campos.valor=valorMonetarioDecimal(campos.valor);
      if (!campos.descricao || !/^\d+(\.\d{1,2})?$/.test(campos.valor) || (campos.dataEmissao && (!/^\d{4}-\d{2}-\d{2}$/.test(campos.dataEmissao) || !Number.isFinite(Date.parse(campos.dataEmissao))))) return Response.json({message:"CONFIRA DESCRIÇÃO, VALOR E DATA DE EMISSÃO."},{status:400});
      notas[indice] = {...notas[indice],...campos};
    }
    const atualizados = await db.update(documentosAssociacao).set({notasFiscaisJson:JSON.stringify(notas),atualizadoEm:new Date().toISOString()}).where(and(eq(documentosAssociacao.id,id),eq(documentosAssociacao.notasFiscaisJson,registro.notasFiscaisJson))).returning({id:documentosAssociacao.id});
    if (!atualizados.length) return Response.json({message:"O REGISTRO FOI ALTERADO. ATUALIZE A PÁGINA E TENTE NOVAMENTE."},{status:409});
    return Response.json({message:acao === "excluir" ? "NOTA EXCLUÍDA." : "NOTA ATUALIZADA."});
  } catch { return Response.json({message:"NÃO FOI POSSÍVEL SALVAR A ALTERAÇÃO."},{status:500}); }
}
