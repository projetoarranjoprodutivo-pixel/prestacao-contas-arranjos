import { env } from "cloudflare:workers";

let inicializado: Promise<void> | null = null;

async function criarTabelasDeAcesso() {
  if (!env.DB) throw new Error("O vínculo DB não está disponível no Worker.");
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS usuarios_acesso (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL,
    senha_hash TEXT NOT NULL,
    senha_salt TEXT NOT NULL,
    funcao TEXT DEFAULT 'colaborador' NOT NULL,
    ativo INTEGER DEFAULT 1 NOT NULL,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`).run();
  await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_acesso_email ON usuarios_acesso(email)").run();
  const colunasUsuario = await env.DB.prepare("PRAGMA table_info(usuarios_acesso)").all<{name:string}>();
  if (!colunasUsuario.results.some(coluna => coluna.name === "associacao")) await env.DB.prepare("ALTER TABLE usuarios_acesso ADD COLUMN associacao TEXT").run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS sessoes_acesso (
    token_hash TEXT PRIMARY KEY NOT NULL,
    usuario_id TEXT NOT NULL,
    expira_em TEXT NOT NULL,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS codigos_recuperacao (
    id TEXT PRIMARY KEY NOT NULL,
    usuario_id TEXT NOT NULL,
    codigo_hash TEXT NOT NULL,
    expira_em TEXT NOT NULL,
    usado INTEGER DEFAULT 0 NOT NULL,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS documentos_associacao (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    auth_user_id TEXT NOT NULL,
    associacao TEXT NOT NULL,
    competencia TEXT NOT NULL,
    extratos_json TEXT DEFAULT '[]' NOT NULL,
    notas_fiscais_json TEXT DEFAULT '[]' NOT NULL,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`).run();
  await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_documentos_associacao_competencia ON documentos_associacao(associacao, competencia)").run();
}

export function garantirBanco() {
  if (!inicializado) inicializado = criarTabelasDeAcesso().catch(error => {
    inicializado = null;
    throw error;
  });
  return inicializado;
}

export async function garantirNomeEmpresarial() {
  if (!env.DB) throw new Error("O vínculo DB não está disponível no Worker.");
  const colunas = await env.DB.prepare("PRAGMA table_info(colaboradores)").all<{name:string}>();
  if (colunas.results.length && !colunas.results.some(coluna => coluna.name === "nome_empresarial")) {
    await env.DB.prepare("ALTER TABLE colaboradores ADD COLUMN nome_empresarial TEXT").run();
  }
  if (colunas.results.length && !colunas.results.some(coluna => coluna.name === "associacoes_json")) {
    await env.DB.prepare("ALTER TABLE colaboradores ADD COLUMN associacoes_json TEXT NOT NULL DEFAULT '[]'").run();
  }
}

const colunasAssociacao = [
  ["bairro", "TEXT"],
  ["numero", "TEXT"],
  ["municipio", "TEXT"],
  ["uf", "TEXT"],
  ["email", "TEXT"],
  ["presidente_nome", "TEXT"],
  ["presidente_cpf", "TEXT"],
  ["presidente_cep", "TEXT"],
  ["presidente_endereco", "TEXT"],
  ["presidente_bairro", "TEXT"],
  ["presidente_numero", "TEXT"],
  ["presidente_municipio", "TEXT"],
  ["presidente_uf", "TEXT"],
  ["presidente_email", "TEXT"],
  ["documentos_json", "TEXT NOT NULL DEFAULT '[]'"],
] as const;

export async function garantirAssociacoesCompletas() {
  if (!env.DB) throw new Error("O vínculo DB não está disponível no Worker.");
  const colunas = await env.DB.prepare("PRAGMA table_info(associacoes)").all<{name:string}>();
  const existentes = new Set(colunas.results.map(coluna => coluna.name));
  for (const [nome, tipo] of colunasAssociacao) {
    if (!existentes.has(nome)) {
      await env.DB.prepare(`ALTER TABLE associacoes ADD COLUMN ${nome} ${tipo}`).run();
    }
  }
}
