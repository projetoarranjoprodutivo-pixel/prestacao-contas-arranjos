# Prestação de Contas — Arranjos Produtivos

Sistema preparado para Cloudflare Workers com banco D1, armazenamento R2 e autenticação própria por e-mail e senha.

Leia primeiro [GUIA_INSTALACAO_CLOUDFLARE.md](GUIA_INSTALACAO_CLOUDFLARE.md). O guia explica a publicação pelo painel da Cloudflare, a criação do banco e do armazenamento, as migrações e a configuração do envio de códigos de recuperação por e-mail.

## Comandos principais

- `pnpm install --frozen-lockfile`: instalar dependências.
- `pnpm build`: gerar a versão de produção.
- `pnpm deploy:cloudflare`: publicar após configurar o D1 e o R2.
- `pnpm db:generate`: gerar uma nova migração após alterar o esquema.

Nunca grave chaves de API no repositório. Cadastre `BREVO_API_KEY` como segredo no painel da Cloudflare.
