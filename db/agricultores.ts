import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import base from "@/data/agricultores-iniciais.json";
import { chaveMunicipio, MUNICIPIOS_POR_ASSOCIACAO } from "@/lib/associacoes-municipios";
import { normalizarNomeAssociacao } from "@/lib/nome-associacao";
import { getDb } from "@/db";
import { associacoes } from "@/db/schema";

export type DadosAgricultor = { nome: string; associacao: string; municipio: string };
export type Agricultor = DadosAgricultor & { id: string; revisao: number; celular: string };
export type GrupoAgricultores = { associacao: string; municipios: string[] };

const iniciais = new Map<string, Agricultor>(base.map(({ n, a, m }) => {
  const id = `base:${JSON.stringify([a, m, n])}`;
  return [id, { id, nome: n, municipio: m, associacao: normalizarNomeAssociacao(a), revisao: 0, celular: "" }];
}));

async function bancoAgricultores() {
  const banco = env.DB;
  if (!banco) throw new Error("Banco de dados do cadastro indisponível.");
  await banco.prepare(`CREATE TABLE IF NOT EXISTS cadastro_agricultores (
    id TEXT PRIMARY KEY NOT NULL,
    nome TEXT NOT NULL,
    associacao TEXT NOT NULL,
    municipio TEXT NOT NULL,
    revisao INTEGER NOT NULL,
    celular TEXT NOT NULL DEFAULT ''
  )`).run();
  const temCelular = async () => (await banco.prepare("PRAGMA table_info(cadastro_agricultores)")
    .all<{ name: string }>()).results.some(coluna => coluna.name === "celular");
  if (!await temCelular()) {
    try {
      await banco.prepare("ALTER TABLE cadastro_agricultores ADD COLUMN celular TEXT NOT NULL DEFAULT ''").run();
    } catch (erro) {
      if (!await temCelular()) throw erro;
    }
  }
  return banco;
}

export async function listarAgricultores() {
  const banco = await bancoAgricultores();
  const alterados = await banco.prepare("SELECT id, nome, associacao, municipio, revisao, celular FROM cadastro_agricultores").all<Agricultor>();
  const registros = new Map(iniciais);
  for (const agricultor of alterados.results) registros.set(agricultor.id, agricultor);
  return [...registros.values()];
}

const compararNomes = new Intl.Collator("pt-BR").compare;

export function filtrosCadastroAgricultores(associacao: unknown, municipio: unknown) {
  return {
    associacao: typeof associacao === "string" && associacao.trim()
      ? normalizarNomeAssociacao(associacao) : "",
    municipio: typeof municipio === "string" ? chaveMunicipio(municipio) : "",
  };
}

export function filtrarAgricultores(
  registros: Agricultor[],
  filtros: ReturnType<typeof filtrosCadastroAgricultores>,
) {
  return registros.filter(r =>
    (!filtros.associacao || r.associacao === filtros.associacao) &&
    (!filtros.municipio || chaveMunicipio(r.municipio) === filtros.municipio),
  ).sort((a, b) => compararNomes(a.nome, b.nome) || a.id.localeCompare(b.id));
}

export async function gruposAgricultores(registros: Agricultor[]): Promise<GrupoAgricultores[]> {
  const grupos = new Map<string, Map<string, string>>();
  function adicionar(associacao: string, municipios: string[]) {
    const nome = normalizarNomeAssociacao(associacao);
    const locais = grupos.get(nome) ?? new Map<string, string>();
    for (const municipio of municipios) {
      const chave = chaveMunicipio(municipio);
      if (chave) locais.set(chave, municipio.trim());
    }
    grupos.set(nome, locais);
  }
  for (const r of registros) adicionar(r.associacao, [r.municipio]);
  for (const [nome, municipios] of MUNICIPIOS_POR_ASSOCIACAO) adicionar(nome, [...municipios]);

  const cadastradas = await getDb()
    .select({ nome: associacoes.nome, municipios: associacoes.municipiosJson })
    .from(associacoes).where(eq(associacoes.ativo, true));

  for (const grupo of cadastradas) {
    let municipios: unknown;
    try { municipios = JSON.parse(grupo.municipios || "[]"); } catch { municipios = []; }
    adicionar(grupo.nome, Array.isArray(municipios)
      ? municipios.filter((item): item is string => typeof item === "string")
      : []);
  }
  const comparar = (a: string, b: string) => a.localeCompare(b, "pt-BR");
  return [...grupos.entries()].map(([associacao, locais]) => ({
    associacao,
    municipios: [...locais.values()].sort(comparar),
  })).sort((a, b) => comparar(a.associacao, b.associacao));
}

export async function gravarAgricultor(
  dados: DadosAgricultor & { celular?: string },
  operacao: { id: string; revisao: number; editar: boolean },
) {
  const banco = await bancoAgricultores();
  const { nome, associacao, municipio, celular } = dados;
  const { id, revisao, editar } = operacao;
  if (!editar || revisao === 0) {
    if (editar && !iniciais.has(id)) return false;
    const resultado = await banco.prepare(`
      INSERT INTO cadastro_agricultores (id, nome, associacao, municipio, revisao, celular)
      VALUES (?, ?, ?, ?, 1, ?) ON CONFLICT(id) DO NOTHING
    `).bind(id, nome, associacao, municipio, celular ?? "").run();
    if (resultado.meta.changes === 1) return true;
    if (editar) return false;
    const existente = await banco.prepare(
      "SELECT 1 AS igual FROM cadastro_agricultores WHERE id = ? AND nome = ? AND associacao = ? AND municipio = ? AND celular = ?",
    ).bind(id, nome, associacao, municipio, celular ?? "").first();
    return existente !== null;
  }
  const resultado = await banco.prepare(`
    UPDATE cadastro_agricultores SET nome = ?, associacao = ?, municipio = ?, celular = COALESCE(?, celular), revisao = revisao + 1
    WHERE id = ? AND revisao = ?
  `).bind(nome, associacao, municipio, celular ?? null, id, revisao).run();
  return resultado.meta.changes === 1;
}
