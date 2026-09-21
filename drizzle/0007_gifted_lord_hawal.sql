ALTER TABLE `associacoes` ADD `razao_social` text;--> statement-breakpoint
ALTER TABLE `associacoes` ADD `cnpj` text;--> statement-breakpoint
ALTER TABLE `associacoes` ADD `cep` text;--> statement-breakpoint
ALTER TABLE `associacoes` ADD `endereco` text;--> statement-breakpoint
ALTER TABLE `associacoes` ADD `telefone` text;--> statement-breakpoint
ALTER TABLE `associacoes` ADD `celular` text;--> statement-breakpoint
ALTER TABLE `associacoes` ADD `municipios_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `colaboradores` ADD `municipios_atendidos_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `colaboradores` ADD `mei` text;--> statement-breakpoint
ALTER TABLE `colaboradores` ADD `cfta_crea` text;