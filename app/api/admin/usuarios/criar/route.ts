import { criarSenha } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { garantirBanco } from "@/db/bootstrap";
import { associacoes, usuariosAcesso } from "@/db/schema";
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
  const funcaoInformada=String(form.get("funcao"));
  const funcao = funcaoInformada === "admin" ? "admin" : funcaoInformada === "associacao" ? "associacao" : "colaborador";
  const associacao=funcao==="associacao"?String(form.get("associacao")||"").trim():null;
  if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ message: "Informe um e-mail válido." }, { status: 400 });
  if (senha.length < 8) return Response.json({ message: "A senha deve ter pelo menos 8 caracteres." }, { status: 400 });
  if (senha !== confirmar) return Response.json({ message: "A confirmação da senha não confere." }, { status: 400 });
  const db = getDb();
  if(funcao==="associacao"&&(!associacao||!await db.query.associacoes.findFirst({where:eq(associacoes.nome,associacao)})))return Response.json({message:"Selecione uma associação válida."},{status:400});
  if (await db.query.usuariosAcesso.findFirst({ where: eq(usuariosAcesso.email, email) })) return Response.json({ message: "Este e-mail já possui usuário." }, { status: 409 });
  const segredo = await criarSenha(senha);
  await db.insert(usuariosAcesso).values({ id: crypto.randomUUID(), email, senhaHash: segredo.hash, senhaSalt: segredo.salt, funcao, associacao, ativo: true });
  return Response.json({ message: funcao === "admin" ? "Novo administrador criado com sucesso." : funcao==="associacao"?"Acesso da associação criado com sucesso.":"Novo colaborador criado com sucesso." });
}
