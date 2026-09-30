import { garantirUsuariosDosColaboradores } from "@/db/bootstrap";
import { getAdminUser } from "@/lib/admin";

export const runtime = "edge";

export async function POST() {
  if (!await getAdminUser()) {
    return Response.json({ message: "ACESSO RESTRITO." }, { status: 403 });
  }
  try {
    const criados = await garantirUsuariosDosColaboradores();
    return Response.json({
      message: criados
        ? `${criados} ACESSO(S) CRIADO(S) COM A SENHA INICIAL 12345678.`
        : "TODOS OS COLABORADORES JÁ POSSUEM USUÁRIO DE ACESSO.",
      criados,
    });
  } catch (error) {
    console.error("sincronizar_usuarios_error", error);
    return Response.json({ message: "NÃO FOI POSSÍVEL CRIAR OS ACESSOS PENDENTES." }, { status: 500 });
  }
}
