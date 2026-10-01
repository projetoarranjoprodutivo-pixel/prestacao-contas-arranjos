import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { colaboradores } from "@/db/schema";
import { getAdminUser } from "@/lib/admin";

export const runtime = "edge";

const CAMPOS = ["agroindustria", "projetos", "associativismo", "geral", "mobilizador"] as const;

export async function POST(request: Request) {
  if (!await getAdminUser()) {
    return Response.json({ message: "Acesso restrito à administração." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    email?: unknown;
    superiores?: Record<string, unknown>;
  } | null;
  const email = String(body?.email || "").trim().toLowerCase();
  const superiores = Object.fromEntries(
    CAMPOS.map((campo) => [campo, String(body?.superiores?.[campo] || "").trim()]),
  );

  if (!/^\S+@\S+\.\S+$/.test(email) || CAMPOS.some((campo) => !superiores[campo])) {
    return Response.json({ message: "Informe o colaborador e todos os superiores." }, { status: 400 });
  }

  const db = getDb();
  const colaborador = await db.query.colaboradores.findFirst({ where: eq(colaboradores.email, email) });
  if (!colaborador) {
    return Response.json({ message: "Colaborador não encontrado." }, { status: 404 });
  }

  await db.update(colaboradores).set({
    superioresJson: JSON.stringify(superiores),
    atualizadoEm: new Date().toISOString(),
  }).where(eq(colaboradores.id, colaborador.id));

  return Response.json({ message: "Superiores atualizados.", nome: colaborador.nomeCompleto, superiores });
}
