import { getChatGPTUser } from "@/app/chatgpt-auth";
import { listarAgricultores } from "@/db/agricultores";
import { normalizarNomeAssociacao } from "@/lib/nome-associacao";

export const runtime = "edge";

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ message: "SESSÃO EXPIRADA." }, { status: 401 });
  }

  const associacao = new URL(request.url).searchParams.get("associacao")?.trim() || "";
  if (!associacao) return Response.json({ agricultores: [] });

  const lista = (await listarAgricultores())
    .filter((item) => item.associacao === normalizarNomeAssociacao(associacao))
    .map((item) => ({
      nome: item.nome,
      municipio: item.municipio === "NÃO INFORMADO" ? "" : item.municipio,
      associacao: item.associacao,
    }));

  return Response.json(
    { agricultores: lista, total: lista.length },
    { headers: { "cache-control": "private, no-store" } }
  );
}
