import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
export const usuariosAcesso = sqliteTable("usuarios_acesso", {
  id:text("id").primaryKey(),email:text("email").notNull(),senhaHash:text("senha_hash").notNull(),senhaSalt:text("senha_salt").notNull(),funcao:text("funcao").notNull().default("colaborador"),ativo:integer("ativo",{mode:"boolean"}).notNull().default(true),criadoEm:text("criado_em").notNull().default(sql`CURRENT_TIMESTAMP`),
},table=>({emailUnique:uniqueIndex("idx_usuarios_acesso_email").on(table.email)}));
export const sessoesAcesso = sqliteTable("sessoes_acesso", {
  tokenHash:text("token_hash").primaryKey(),usuarioId:text("usuario_id").notNull(),expiraEm:text("expira_em").notNull(),criadoEm:text("criado_em").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const codigosRecuperacao = sqliteTable("codigos_recuperacao", {
  id:text("id").primaryKey(),usuarioId:text("usuario_id").notNull(),codigoHash:text("codigo_hash").notNull(),expiraEm:text("expira_em").notNull(),usado:integer("usado",{mode:"boolean"}).notNull().default(false),criadoEm:text("criado_em").notNull().default(sql`CURRENT_TIMESTAMP`),
});
export const colaboradores = sqliteTable("colaboradores", {
  id: integer("id").primaryKey({ autoIncrement: true }), authUserId: text("auth_user_id").notNull(), email: text("email").notNull(), nomeCompleto: text("nome_completo").notNull(), dataNascimento: text("data_nascimento").notNull(), cpf: text("cpf").notNull(), sexo: text("sexo").notNull(), cargo: text("cargo").notNull(), associacao: text("associacao"), municipiosAtendidosJson: text("municipios_atendidos_json").notNull().default("[]"), mei: text("mei"), nomeEmpresarial: text("nome_empresarial"), cftaCrea: text("cfta_crea"), cep: text("cep").notNull(), endereco: text("endereco").notNull(), numero: text("numero").notNull(), complemento: text("complemento"), bairro: text("bairro").notNull(), cidade: text("cidade").notNull(), uf: text("uf").notNull(), celular: text("celular").notNull(), atendimentosJson: text("atendimentos_json").notNull().default("[]"), superioresJson: text("superiores_json").notNull().default("{}"), documentoKey: text("documento_key"), documentoNome: text("documento_nome"), documentoTipo: text("documento_tipo"), documentosJson: text("documentos_json"), documentoValidade: text("documento_validade").notNull(), criadoEm: text("criado_em").notNull().default(sql`CURRENT_TIMESTAMP`), atualizadoEm: text("atualizado_em").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => ({ authUserUnique: uniqueIndex("idx_colaboradores_auth_user_id").on(table.authUserId), cpfUnique: uniqueIndex("idx_colaboradores_cpf").on(table.cpf), emailUnique: uniqueIndex("idx_colaboradores_email").on(table.email) }));

export const prestacoes = sqliteTable("prestacoes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  authUserId: text("auth_user_id").notNull(),
  competencia: text("competencia").notNull(),
  municipio: text("municipio").notNull(),
  associacao: text("associacao").notNull(),
  atividadesJson: text("atividades_json").notNull(),
  totalMinutos: integer("total_minutos").notNull().default(0),
  anexosJson: text("anexos_json").notNull().default("[]"),
  observacoes: text("observacoes"),
  status: text("status").notNull().default("enviado"),
  criadoEm: text("criado_em").notNull().default(sql`CURRENT_TIMESTAMP`),
  atualizadoEm: text("atualizado_em").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => ({ competenciaUsuarioUnique: uniqueIndex("idx_prestacoes_usuario_competencia").on(table.authUserId, table.competencia) }));

export const planosTrabalho = sqliteTable("planos_trabalho", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  authUserId: text("auth_user_id").notNull(),
  competencia: text("competencia").notNull(),
  associacao: text("associacao").notNull(),
  agendaJson: text("agenda_json").notNull(),
  status: text("status").notNull().default("enviado"),
  criadoEm: text("criado_em").notNull().default(sql`CURRENT_TIMESTAMP`),
  atualizadoEm: text("atualizado_em").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => ({ competenciaUsuarioUnique: uniqueIndex("idx_planos_usuario_competencia").on(table.authUserId, table.competencia) }));

export const associacoes = sqliteTable("associacoes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nome: text("nome").notNull(),
  razaoSocial: text("razao_social"),
  cnpj: text("cnpj"),
  cep: text("cep"),
  endereco: text("endereco"),
  telefone: text("telefone"),
  celular: text("celular"),
  municipiosJson: text("municipios_json").notNull().default("[]"),
  ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
  criadoEm: text("criado_em").notNull().default(sql`CURRENT_TIMESTAMP`),
}, table => ({ nomeUnique: uniqueIndex("idx_associacoes_nome").on(table.nome) }));
