import { getDb } from "@/db";
import { garantirAssociacoesCompletas } from "@/db/bootstrap";
import { associacoes } from "@/db/schema";
import { getAdminUser } from "@/lib/admin";
import { gerarPdfAssociacoes } from "@/lib/associacoes-pdf";
import { asc, eq, inArray } from "drizzle-orm";

export const runtime = "edge";

export async function GET(request: Request) {
  if (!await getAdminUser()) return new Response("Acesso restrito", { status: 403 });
  await garantirAssociacoesCompletas();

  const url = new URL(request.url);
  const todas = url.searchParams.get("todas") === "1";
  const ids = [...new Set((url.searchParams.get("ids") || "").split(",").map(Number).filter(id => Number.isInteger(id) && id > 0))];
  if (!todas && !ids.length) return new Response("Selecione ao menos uma associação.", { status: 400 });

  const db = getDb();
  const registros = await db.select().from(associacoes)
    .where(todas ? eq(associacoes.ativo, true) : inArray(associacoes.id, ids))
    .orderBy(asc(associacoes.nome));
  if (!registros.length) return new Response("Nenhuma associação encontrada.", { status: 404 });

  const pdf = await gerarPdfAssociacoes(registros);
  return new Response(pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="associacoes-${todas ? "todas" : "selecionadas"}.pdf"`,
    },
  });
}
