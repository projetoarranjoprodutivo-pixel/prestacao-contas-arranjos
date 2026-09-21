ALTER TABLE `associacoes` ADD `bairro` text;
--> statement-breakpoint
ALTER TABLE `associacoes` ADD `numero` text;
--> statement-breakpoint
ALTER TABLE `associacoes` ADD `municipio` text;
--> statement-breakpoint
ALTER TABLE `associacoes` ADD `uf` text;
--> statement-breakpoint
ALTER TABLE `associacoes` ADD `email` text;
--> statement-breakpoint
ALTER TABLE `associacoes` ADD `presidente_nome` text;
--> statement-breakpoint
ALTER TABLE `associacoes` ADD `presidente_cpf` text;
--> statement-breakpoint
ALTER TABLE `associacoes` ADD `presidente_cep` text;
--> statement-breakpoint
ALTER TABLE `associacoes` ADD `presidente_endereco` text;
--> statement-breakpoint
ALTER TABLE `associacoes` ADD `presidente_bairro` text;
--> statement-breakpoint
ALTER TABLE `associacoes` ADD `presidente_numero` text;
--> statement-breakpoint
ALTER TABLE `associacoes` ADD `presidente_municipio` text;
--> statement-breakpoint
ALTER TABLE `associacoes` ADD `presidente_uf` text;
--> statement-breakpoint
ALTER TABLE `associacoes` ADD `presidente_email` text;
--> statement-breakpoint
ALTER TABLE `associacoes` ADD `documentos_json` text DEFAULT '[]' NOT NULL;
