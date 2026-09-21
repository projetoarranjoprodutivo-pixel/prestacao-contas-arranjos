import { criarSenha, criarSessao } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { usuariosAcesso } from "@/db/schema";
import { isAdminPrincipal } from "@/lib/admin-principal";
import { eq } from "drizzle-orm";

export const runtime = "edge";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const senha = String(form.get("senha") || "");
  if (!/^\S+@\S+\.\S+$/.test(email) || senha.length < 8) return Response.json({ message: "Informe um e-mail válido e uma senha com pelo menos 8 caracteres." }, { status: 400 });
  if (isAdminPrincipal(email)) return Response.json({ message: "Este e-mail é reservado ao administrador principal. Use o login administrativo." }, { status: 403 });
  const db = getDb();
  if (await db.query.usuariosAcesso.findFirst({ where: eq(usuariosAcesso.email, email) })) return Response.json({ message: "Este e-mail já possui conta." }, { status: 409 });
  const id = crypto.randomUUID();
  const segredo = await criarSenha(senha);
  await db.insert(usuariosAcesso).values({ id, email, senhaHash: segredo.hash, senhaSalt: segredo.salt, funcao: "colaborador" });
  await criarSessao(id);
  return Response.json({ redirect: "/cadastro" });
}
