import { getDb } from "@/db";
import { colaboradores, sessoesAcesso, usuariosAcesso } from "@/db/schema";
import { garantirBanco } from "@/db/bootstrap";
import { getAdminUser, isAdminEmail } from "@/lib/admin";
import { eq, or } from "drizzle-orm";

export const runtime = "edge";

export async function POST(request: Request) {
  const administrador = await getAdminUser();
  if (!administrador || !isAdminEmail(administrador.email)) {
    return Response.json({ message: "APENAS O ADMINISTRADOR PRINCIPAL PODE EDITAR USUÁRIOS." }, { status: 403 });
  }

  await garantirBanco();
  const form = await request.formData();
  const id = String(form.get("id") || "").trim();
  const nomeCompleto = String(form.get("nomeCompleto") || "").trim().toLocaleUpperCase("pt-BR");
  const email = String(form.get("email") || "").trim().toLowerCase();
  const funcaoInformada = String(form.get("funcao") || "");
  const funcao = ["colaborador", "associacao", "aderes", "admin"].includes(funcaoInformada) ? funcaoInformada : "colaborador";
  const associacao = funcao === "associacao" ? String(form.get("associacao") || "").trim().toLocaleUpperCase("pt-BR") : null;

  if (!id || !nomeCompleto) return Response.json({ message: "INFORME O NOME DO USUÁRIO." }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ message: "INFORME UM E-MAIL VÁLIDO." }, { status: 400 });
  if (funcao === "associacao" && !associacao) return Response.json({ message: "SELECIONE A ASSOCIAÇÃO." }, { status: 400 });

  const db = getDb();
  const atual = await db.query.usuariosAcesso.findFirst({ where: eq(usuariosAcesso.id, id) });
  if (!atual) return Response.json({ message: "USUÁRIO NÃO ENCONTRADO." }, { status: 404 });
  if (isAdminEmail(atual.email)) return Response.json({ message: "O USUÁRIO ADMINISTRADOR PRINCIPAL NÃO PODE SER ALTERADO NESTA TELA." }, { status: 400 });

  const emailEmUso = await db.query.usuariosAcesso.findFirst({ where: eq(usuariosAcesso.email, email) });
  if (emailEmUso && emailEmUso.id !== id) return Response.json({ message: "ESTE E-MAIL JÁ ESTÁ SENDO USADO POR OUTRO USUÁRIO." }, { status: 409 });

  const colaborador = await db.query.colaboradores.findFirst({
    where: or(eq(colaboradores.authUserId, id), eq(colaboradores.email, atual.email)),
  });

  await db.update(usuariosAcesso).set({ nome: nomeCompleto, email, funcao, associacao }).where(eq(usuariosAcesso.id, id));
  if (colaborador) {
    await db.update(colaboradores)
      .set({ nomeCompleto, email, atualizadoEm: new Date().toISOString() })
      .where(eq(colaboradores.id, colaborador.id));
  }
  await db.delete(sessoesAcesso).where(eq(sessoesAcesso.usuarioId, id));

  return Response.json({
    message: colaborador
      ? "USUÁRIO E CADASTRO DO COLABORADOR ATUALIZADOS COM SUCESSO."
      : "ACESSO ATUALIZADO. ESTE USUÁRIO NÃO POSSUI CADASTRO DE COLABORADOR VINCULADO PARA ALTERAR O NOME.",
  });
}
