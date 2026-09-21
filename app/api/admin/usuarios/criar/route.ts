import { criarSenha } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { garantirBanco } from "@/db/bootstrap";
import { usuariosAcesso } from "@/db/schema";
import { getAdminUser } from "@/lib/admin";
import { eq } from "drizzle-orm";

export const runtime = "edge";

export async function POST(request: Request) {
  if (!await getAdminUser()) return Response.json({ message: "Acesso restrito à administração." }, { status: 403 });
  await garantirBanco();
  const form = await request.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const senha = String(form.get("senha") || "");
  const confirmar = String(form.get("confirmarSenha") || "");
  const funcao = String(form.get("funcao")) === "admin" ? "admin" : "colaborador";
  if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ message: "Informe um e-mail válido." }, { status: 400 });
  if (senha.length < 8) return Response.json({ message: "A senha deve ter pelo menos 8 caracteres." }, { status: 400 });
  if (senha !== confirmar) return Response.json({ message: "A confirmação da senha não confere." }, { status: 400 });
  const db = getDb();
  if (await db.query.usuariosAcesso.findFirst({ where: eq(usuariosAcesso.email, email) })) return Response.json({ message: "Este e-mail já possui usuário." }, { status: 409 });
  const segredo = await criarSenha(senha);
  await db.insert(usuariosAcesso).values({ id: crypto.randomUUID(), email, senhaHash: segredo.hash, senhaSalt: segredo.salt, funcao, ativo: true });
  return Response.json({ message: funcao === "admin" ? "Novo administrador criado com sucesso." : "Novo colaborador criado com sucesso." });
}
