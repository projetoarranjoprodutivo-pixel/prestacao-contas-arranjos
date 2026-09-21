import { criarSenha, verificarSenha } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { sessoesAcesso, usuariosAcesso } from "@/db/schema";
import { getAdminUser, isAdminEmail } from "@/lib/admin";
import { eq } from "drizzle-orm";

export const runtime = "edge";

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin || !isAdminEmail(admin.email)) return Response.json({ message: "Somente o administrador principal pode alterar esta senha." }, { status: 403 });
  const form = await request.formData();
  const atual = String(form.get("senhaAtual") || "");
  const nova = String(form.get("novaSenha") || "");
  const confirmacao = String(form.get("confirmarSenha") || "");
  if (nova.length < 8) return Response.json({ message: "A nova senha deve ter pelo menos 8 caracteres." }, { status: 400 });
  if (nova !== confirmacao) return Response.json({ message: "A confirmação da nova senha não confere." }, { status: 400 });
  const db = getDb();
  const usuario = await db.query.usuariosAcesso.findFirst({ where: eq(usuariosAcesso.id, admin.userId) });
  if (!usuario || !await verificarSenha(atual, usuario.senhaSalt, usuario.senhaHash)) return Response.json({ message: "A senha administrativa atual está incorreta." }, { status: 400 });
  const segredo = await criarSenha(nova);
  await db.update(usuariosAcesso).set({ senhaHash: segredo.hash, senhaSalt: segredo.salt, funcao: "admin", ativo: true }).where(eq(usuariosAcesso.id, usuario.id));
  await db.delete(sessoesAcesso).where(eq(sessoesAcesso.usuarioId, usuario.id));
  return Response.json({ message: "Senha administrativa alterada. Entre novamente com a nova senha.", redirect: "/entrar?return_to=%2Fadmin" });
}
