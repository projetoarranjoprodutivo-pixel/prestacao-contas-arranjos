CREATE TABLE `prestacoes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`auth_user_id` text NOT NULL,
	`competencia` text NOT NULL,
	`municipio` text NOT NULL,
	`associacao` text NOT NULL,
	`atividades_json` text NOT NULL,
	`total_minutos` integer DEFAULT 0 NOT NULL,
	`anexos_json` text DEFAULT '[]' NOT NULL,
	`observacoes` text,
	`status` text DEFAULT 'enviado' NOT NULL,
	`criado_em` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`atualizado_em` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_prestacoes_usuario_competencia` ON `prestacoes` (`auth_user_id`,`competencia`);