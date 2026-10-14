import { getDb } from "@/db";
import { sessoesAcesso, usuariosAcesso } from "@/db/schema";
import { garantirBanco } from "@/db/bootstrap";
import { getAdminUser, isAdminEmail } from "@/lib/admin";
import { eq } from "drizzle-orm";

export const runtime = "edge";

export async function POST(request: Request) {
  const administrador = await getAdminUser();
  if (!administrador || !isAdminEmail(administrador.email)) {
    return Response.json({ message: "APENAS O ADMINISTRADOR PRINCIPAL PODE EXCLUIR ACESSOS." }, { status: 403 });
  }

  await garantirBanco();
  const form = await request.formData();
  const id = String(form.get("id") || "").trim();
  if (!id) return Response.json({ message: "USUÁRIO INVÁLIDO." }, { status: 400 });

  const db = getDb();
  const usuario = await db.query.usuariosAcesso.findFirst({ where: eq(usuariosAcesso.id, id) });
  if (!usuario) return Response.json({ message: "USUÁRIO NÃO ENCONTRADO." }, { status: 404 });
  if (isAdminEmail(usuario.email)) {
    return Response.json({ message: "O ADMINISTRADOR PRINCIPAL NÃO PODE SER EXCLUÍDO." }, { status: 400 });
  }

  await db.delete(sessoesAcesso).where(eq(sessoesAcesso.usuarioId, id));
  await db.delete(usuariosAcesso).where(eq(usuariosAcesso.id, id));
  return Response.json({ message: "ACESSO EXCLUÍDO COM SUCESSO. O CADASTRO E OS RELATÓRIOS DO COLABORADOR FORAM MANTIDOS." });
}
