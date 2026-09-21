import { env } from "cloudflare:workers";

let inicializado: Promise<void> | null = null;

export function garantirBanco() {
  if (!env.DB) throw new Error("Banco D1 não configurado.");
  if (!inicializado) inicializado = env.DB.exec(`
    CREATE TABLE IF NOT EXISTS usuarios_acesso (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL,
      senha_hash TEXT NOT NULL,
      senha_salt TEXT NOT NULL,
      funcao TEXT DEFAULT 'colaborador' NOT NULL,
      ativo INTEGER DEFAULT 1 NOT NULL,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_acesso_email ON usuarios_acesso(email);
    CREATE TABLE IF NOT EXISTS sessoes_acesso (
      token_hash TEXT PRIMARY KEY NOT NULL,
      usuario_id TEXT NOT NULL,
      expira_em TEXT NOT NULL,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
    CREATE TABLE IF NOT EXISTS codigos_recuperacao (
      id TEXT PRIMARY KEY NOT NULL,
      usuario_id TEXT NOT NULL,
      codigo_hash TEXT NOT NULL,
      expira_em TEXT NOT NULL,
      usado INTEGER DEFAULT 0 NOT NULL,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
    CREATE TABLE IF NOT EXISTS colaboradores (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      auth_user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      nome_completo TEXT NOT NULL,
      data_nascimento TEXT NOT NULL,
      cpf TEXT NOT NULL,
      sexo TEXT NOT NULL,
      cargo TEXT NOT NULL,
      associacao TEXT,
      municipios_atendidos_json TEXT DEFAULT '[]' NOT NULL,
      mei TEXT,
      cfta_crea TEXT,
      cep TEXT NOT NULL,
      endereco TEXT NOT NULL,
      numero TEXT NOT NULL,
      complemento TEXT,
      bairro TEXT NOT NULL,
      cidade TEXT NOT NULL,
      uf TEXT NOT NULL,
      celular TEXT NOT NULL,
      atendimentos_json TEXT DEFAULT '[]' NOT NULL,
      superiores_json TEXT DEFAULT '{}' NOT NULL,
      documento_key TEXT,
      documento_nome TEXT,
      documento_tipo TEXT,
      documentos_json TEXT,
      documento_validade TEXT NOT NULL,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_colaboradores_auth_user_id ON colaboradores(auth_user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_colaboradores_cpf ON colaboradores(cpf);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_colaboradores_email ON colaboradores(email);
    CREATE TABLE IF NOT EXISTS associacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      nome TEXT NOT NULL,
      razao_social TEXT,
      cnpj TEXT,
      cep TEXT,
      endereco TEXT,
      telefone TEXT,
      celular TEXT,
      municipios_json TEXT DEFAULT '[]' NOT NULL,
      ativo INTEGER DEFAULT 1 NOT NULL,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_associacoes_nome ON associacoes(nome);
    CREATE TABLE IF NOT EXISTS planos_trabalho (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      auth_user_id TEXT NOT NULL,
      competencia TEXT NOT NULL,
      associacao TEXT NOT NULL,
      agenda_json TEXT NOT NULL,
      status TEXT DEFAULT 'enviado' NOT NULL,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_planos_usuario_competencia ON planos_trabalho(auth_user_id, competencia);
    CREATE TABLE IF NOT EXISTS prestacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      auth_user_id TEXT NOT NULL,
      competencia TEXT NOT NULL,
      municipio TEXT NOT NULL,
      associacao TEXT NOT NULL,
      atividades_json TEXT NOT NULL,
      total_minutos INTEGER DEFAULT 0 NOT NULL,
      anexos_json TEXT DEFAULT '[]' NOT NULL,
      observacoes TEXT,
      status TEXT DEFAULT 'enviado' NOT NULL,
      criado_em TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
      atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_prestacoes_usuario_competencia ON prestacoes(auth_user_id, competencia);
  `).then(() => undefined).catch(error => { inicializado = null; throw error; });
  return inicializado;
}
