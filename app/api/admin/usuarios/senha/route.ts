import { criarSenha } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { sessoesAcesso, usuariosAcesso } from "@/db/schema";
import { getAdminUser, isAdminEmail } from "@/lib/admin";
import { eq } from "drizzle-orm";

export const runtime = "edge";

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin || !isAdminEmail(admin.email)) {
    return Response.json(
      { message: "SOMENTE RAFAELDALLA@HOTMAIL.COM PODE ALTERAR A SENHA DOS DEMAIS USUÁRIOS." },
      { status: 403 }
    );
  }

  const form = await request.formData();
  const id = String(form.get("id") || "").trim();
  const novaSenha = String(form.get("novaSenha") || "");
  const confirmarSenha = String(form.get("confirmarSenha") || "");

  if (!id) return Response.json({ message: "USUÁRIO NÃO INFORMADO." }, { status: 400 });
  if (novaSenha.length < 8) {
    return Response.json({ message: "A NOVA SENHA DEVE TER PELO MENOS 8 CARACTERES." }, { status: 400 });
  }
  if (novaSenha !== confirmarSenha) {
    return Response.json({ message: "A CONFIRMAÇÃO DA SENHA NÃO CONFERE." }, { status: 400 });
  }

  const db = getDb();
  const usuario = await db.query.usuariosAcesso.findFirst({
    where: eq(usuariosAcesso.id, id),
  });
  if (!usuario) return Response.json({ message: "USUÁRIO NÃO ENCONTRADO." }, { status: 404 });
  if (isAdminEmail(usuario.email)) {
    return Response.json(
      { message: "USE O FORMULÁRIO SENHA ADMINISTRATIVA PARA ALTERAR A SENHA PRINCIPAL." },
      { status: 400 }
    );
  }

  const segredo = await criarSenha(novaSenha);
  await db.update(usuariosAcesso)
    .set({ senhaHash: segredo.hash, senhaSalt: segredo.salt })
    .where(eq(usuariosAcesso.id, usuario.id));
  await db.delete(sessoesAcesso).where(eq(sessoesAcesso.usuarioId, usuario.id));

  return Response.json({
    message: `SENHA DE ${usuario.email.toLocaleUpperCase("pt-BR")} ALTERADA COM SUCESSO.`,
  });
}
