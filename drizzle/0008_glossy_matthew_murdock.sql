CREATE TABLE `codigos_recuperacao` (
	`id` text PRIMARY KEY NOT NULL,
	`usuario_id` text NOT NULL,
	`codigo_hash` text NOT NULL,
	`expira_em` text NOT NULL,
	`usado` integer DEFAULT false NOT NULL,
	`criado_em` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessoes_acesso` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`usuario_id` text NOT NULL,
	`expira_em` text NOT NULL,
	`criado_em` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `usuarios_acesso` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`senha_hash` text NOT NULL,
	`senha_salt` text NOT NULL,
	`funcao` text DEFAULT 'colaborador' NOT NULL,
	`ativo` integer DEFAULT true NOT NULL,
	`criado_em` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_usuarios_acesso_email` ON `usuarios_acesso` (`email`);