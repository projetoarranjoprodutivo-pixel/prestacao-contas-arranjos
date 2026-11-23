import { gravarAgricultor, gruposAgricultores, listarAgricultores } from "@/db/agricultores";
import { getAdminUser } from "@/lib/admin";
import { chaveMunicipio } from "@/lib/associacoes-municipios";
import { normalizarNomeAssociacao } from "@/lib/nome-associacao";
import { z } from "zod";

export const runtime = "edge";

const campos = z.object({
  nome: z.string().trim().min(1).max(200),
  associacao: z.string().trim().min(1).max(200),
  municipio: z.string().trim().min(1).max(150),
});
const camposInclusao = campos.extend({ id: z.string().uuid(), revisao: z.literal(0) });
const camposEdicao = campos.extend({
  id: z.string().min(1).max(500),
  revisao: z.number().int().nonnegative(),
});

async function salvar(request: Request, editar: boolean) {
  if (!await getAdminUser()) return Response.json({ message: "Acesso restrito." }, { status: 403 });

  const corpo: unknown = await request.json().catch(() => null);
  const dados = (editar ? camposEdicao : camposInclusao).safeParse(corpo);
  if (!dados.success) {
    return Response.json({ message: "Informe o nome, a associação e o município." }, { status: 400 });
  }

  const lista = await listarAgricultores();
  const grupos = await gruposAgricultores(lista);
  const associacao = normalizarNomeAssociacao(dados.data.associacao);
  const municipio = grupos.find(item => item.associacao === associacao)?.municipios
    .find(item => chaveMunicipio(item) === chaveMunicipio(dados.data.municipio));
  if (!municipio) {
    return Response.json({ message: "Selecione um município da associação." }, { status: 400 });
  }

  const { nome, id, revisao } = dados.data;
  const salvo = await gravarAgricultor({ nome, associacao, municipio }, { id, revisao, editar });
  if (!salvo) {
    return Response.json({ message: "O cadastro foi alterado. Feche o formulário, atualize a página e tente novamente." }, { status: 409 });
  }
  return Response.json({ ok: true }, { status: editar ? 200 : 201 });
}

export function POST(request: Request) {
  return salvar(request, false);
}

export function PATCH(request: Request) {
  return salvar(request, true);
}
