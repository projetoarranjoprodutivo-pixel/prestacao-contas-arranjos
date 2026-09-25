import { getChatGPTUser } from "@/app/chatgpt-auth";
import agricultores from "@/data/agricultores-iniciais.json";

export const runtime = "edge";

type AgricultorBase = { n: string; m: string; a: string };

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ message: "SESSÃO EXPIRADA." }, { status: 401 });
  }

  const associacao = new URL(request.url).searchParams.get("associacao")?.trim() || "";
  if (!associacao) return Response.json({ agricultores: [] });

  const lista = (agricultores as AgricultorBase[])
    .filter((item) => item.a === associacao)
    .map((item) => ({
      nome: item.n,
      municipio: item.m === "NÃO INFORMADO" ? "" : item.m,
      associacao: item.a,
    }));

  return Response.json(
    { agricultores: lista, total: lista.length },
    { headers: { "cache-control": "private, max-age=300" } }
  );
}
