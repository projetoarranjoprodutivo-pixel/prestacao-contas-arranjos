CREATE TABLE `colaboradores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`auth_user_id` text NOT NULL,
	`email` text NOT NULL,
	`nome_completo` text NOT NULL,
	`data_nascimento` text NOT NULL,
	`cpf` text NOT NULL,
	`sexo` text NOT NULL,
	`cargo` text NOT NULL,
	`cep` text NOT NULL,
	`endereco` text NOT NULL,
	`numero` text NOT NULL,
	`complemento` text,
	`bairro` text NOT NULL,
	`cidade` text NOT NULL,
	`uf` text NOT NULL,
	`celular` text NOT NULL,
	`documento_key` text,
	`documento_nome` text,
	`documento_tipo` text,
	`documento_validade` text NOT NULL,
	`criado_em` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`atualizado_em` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_colaboradores_auth_user_id` ON `colaboradores` (`auth_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_colaboradores_cpf` ON `colaboradores` (`cpf`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_colaboradores_email` ON `colaboradores` (`email`);