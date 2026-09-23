# Prestação de Contas — Arranjos Produtivos

Sistema preparado para Cloudflare Workers com banco D1, armazenamento Workers KV e autenticação própria por e-mail e senha.

Leia primeiro [GUIA_INSTALACAO_CLOUDFLARE.md](GUIA_INSTALACAO_CLOUDFLARE.md). O guia explica a publicação pelo painel da Cloudflare, a criação do banco e do armazenamento KV sem R2, as migrações e a configuração do envio de códigos de recuperação por e-mail.

## Comandos principais

- `pnpm install --frozen-lockfile`: instalar dependências.
- `pnpm build`: gerar a versão de produção.
- `pnpm deploy:cloudflare`: publicar após configurar o D1 e o Workers KV.
- `pnpm db:generate`: gerar uma nova migração após alterar o esquema.

Nunca grave chaves de API no repositório. Cadastre `BREVO_API_KEY` como segredo no painel da Cloudflare.

<!-- Implantação consolidada do portal das associações: 2026-09-23 -->

<!-- Implantação consolidada: acesso por usuário da associação -->

<!-- Implantação consolidada: login exclusivo das associações -->
