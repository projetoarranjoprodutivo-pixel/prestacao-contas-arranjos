import { filtrarAgricultores, filtrosCadastroAgricultores, listarAgricultores } from "@/db/agricultores";
import { getAdminUser } from "@/lib/admin";
import { criarPlanilhaXlsx } from "@/lib/xlsx-template";

export const runtime = "edge";

export async function GET(request: Request) {
  if (!await getAdminUser()) return new Response("ACESSO RESTRITO", { status: 403 });

  const params = new URL(request.url).searchParams;
  const filtros = filtrosCadastroAgricultores(params.get("associacao"), params.get("municipio"));
  const agricultores = filtrarAgricultores(await listarAgricultores(), filtros);
  const planilha = criarPlanilhaXlsx("Agricultores", [
    ["Nome", "Associação", "Município", "Celular"],
    ...agricultores.map(a => [a.nome, a.associacao, a.municipio, a.celular]),
  ], [44, 24, 32, 23]);

  return new Response(new Uint8Array(planilha), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="cadastro-agricultores.xlsx"',
      "Cache-Control": "private, no-store",
    },
  });
}
