CREATE TABLE `associacoes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`nome` text NOT NULL,
	`ativo` integer DEFAULT true NOT NULL,
	`criado_em` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_associacoes_nome` ON `associacoes` (`nome`);
--> statement-breakpoint
INSERT INTO `associacoes` (`nome`) VALUES
	('AAFAIAR'), ('AAFAMA'), ('AAFARSCRUZ'), ('AAFATRIM'), ('APEAGRI'),
	('APROFASAUNA'), ('APROVIPA'), ('APRUVAB'), ('APRVG'), ('ARQSCD'),
	('CAF COLATINA'), ('MUNIZ CAF'), ('NEEMIAS');
