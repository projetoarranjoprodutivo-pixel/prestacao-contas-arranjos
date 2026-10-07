import { env } from "cloudflare:workers";

const SENHA_INICIAL_COLABORADOR = "12345678";
const bytes = (quantidade: number) => { const valor = new Uint8Array(quantidade); crypto.getRandomValues(valor); return valor; };
const hex = (valor: ArrayBuffer | Uint8Array) => [...new Uint8Array(valor instanceof Uint8Array ? valor.buffer : valor)].map(item => item.toString(16).padStart(2, "0")).join("");
async function criarSenhaInicial() {
  const salt = hex(bytes(16));
  const chave = await crypto.subtle.importKey("raw", new TextEncoder().encode(SENHA_INICIAL_COLABORADOR), "PBKDF2", false, ["deriveBits"]);
  const resultado = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 100000, hash: "SHA-256" }, chave, 256);
  return { salt, hash: hex(resultado) };
}

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
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS itens_plano_associacao (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    item TEXT NOT NULL,
    descricao TEXT DEFAULT '' NOT NULL,
    quantidade TEXT DEFAULT '' NOT NULL,
    unidade TEXT DEFAULT '' NOT NULL,
    valor_unitario TEXT DEFAULT '' NOT NULL,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`).run();
  await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_itens_plano_associacao_item ON itens_plano_associacao(item)").run();
  await garantirUsuariosDosColaboradores();
}

export async function garantirUsuariosDosColaboradores() {
  if (!env.DB) throw new Error("O vínculo DB não está disponível no Worker.");
  const tabela = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'colaboradores'").first<{name:string}>();
  if (!tabela) return 0;
  const registros = await env.DB.prepare(`SELECT c.auth_user_id, LOWER(TRIM(c.email)) AS email
    FROM colaboradores c
    WHERE TRIM(COALESCE(c.email, '')) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM usuarios_acesso u
        WHERE LOWER(u.email) = LOWER(TRIM(c.email)) OR u.id = c.auth_user_id
      )`).all<{auth_user_id:string;email:string}>();
  let criados = 0;
  for (const registro of registros.results) {
    if (!/^\S+@\S+\.\S+$/.test(registro.email)) continue;
    const segredo = await criarSenhaInicial();
    const resultado = await env.DB.prepare(`INSERT OR IGNORE INTO usuarios_acesso
      (id, email, senha_hash, senha_salt, funcao, ativo)
      VALUES (?, ?, ?, ?, 'colaborador', 1)`).bind(
        registro.auth_user_id, registro.email, segredo.hash, segredo.salt
      ).run();
    if (resultado.meta.changes > 0) criados++;
  }
  return criados;
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
  ["usuario", "TEXT"],
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
