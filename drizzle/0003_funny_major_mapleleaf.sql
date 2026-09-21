CREATE TABLE `planos_trabalho` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`auth_user_id` text NOT NULL,
	`competencia` text NOT NULL,
	`associacao` text NOT NULL,
	`agenda_json` text NOT NULL,
	`status` text DEFAULT 'enviado' NOT NULL,
	`criado_em` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`atualizado_em` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_planos_usuario_competencia` ON `planos_trabalho` (`auth_user_id`,`competencia`);