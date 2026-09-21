# Instalação no Cloudflare

Este pacote contém o site completo, banco inicialmente vazio, autenticação por e-mail e senha, recuperação de senha por código enviado por e-mail, banco D1 e armazenamento de anexos no R2.

> Este é um sistema dinâmico. Ele não deve ser enviado pela opção de páginas estáticas (arrastar e soltar). O caminho mais simples pelo site é colocar o código em um repositório privado do GitHub e importá-lo no painel da Cloudflare.

## 1. Colocar os arquivos no GitHub pelo navegador

1. Acesse https://github.com/new e crie um repositório **privado** chamado `prestacao-contas-arranjos`.
2. Extraia este ZIP no computador.
3. No repositório, escolha **Add file > Upload files**.
4. Envie todo o conteúdo da pasta extraída, mantendo as pastas, e confirme em **Commit changes**.

## 2. Criar o banco D1

1. No painel da Cloudflare, abra **Storage & Databases > D1 SQL database > Create**.
2. Use o nome `arranjos-produtivos-db`.
3. Copie o identificador do banco (Database ID).
4. No GitHub, edite `wrangler.cloudflare.jsonc` e substitua `COLE_AQUI_O_ID_DO_D1` pelo identificador copiado.
5. No console do D1, execute, nesta ordem, os arquivos da pasta `drizzle`, do `0000` ao `0008`.
6. Se o console não aceitar a linha `--> statement-breakpoint`, apague somente essa marca antes de executar o conteúdo.

As tabelas começam sem colaboradores, planos ou prestações de contas. A migração inclui apenas a lista inicial de associações necessária para o cadastro.

## 3. Criar o armazenamento R2

1. Abra **Storage & Databases > R2 Object Storage > Create bucket**.
2. Use o nome `arranjos-produtivos-arquivos`.

O vínculo com o nome `BUCKET` já está configurado no arquivo do projeto.

## 4. Configurar o envio de código por e-mail

O projeto está preparado para usar a API da Brevo.

1. Crie a conta na Brevo e confirme um remetente.
2. Na Brevo, crie uma chave de API.
3. No Worker da Cloudflare, abra **Settings > Variables and Secrets**.
4. Adicione `BREVO_API_KEY` como segredo, com a chave da API.
5. Adicione `EMAIL_REMETENTE` com o endereço confirmado na Brevo.

Sem essas duas variáveis, o login normal funciona, mas o código de recuperação não será enviado.

## 5. Publicar pelo painel da Cloudflare

1. Abra **Workers & Pages > Create application > Import a repository**.
2. Conecte o GitHub e selecione o repositório privado.
3. Use estes comandos:
   - Build command: `pnpm install --frozen-lockfile && pnpm build`
   - Deploy command: `pnpm exec wrangler deploy --config wrangler.cloudflare.jsonc`
4. Salve e inicie a implantação.

Ao final, a Cloudflare fornecerá um endereço gratuito terminado em `.workers.dev`.

## 6. Criar o primeiro administrador

1. Abra o endereço publicado e selecione **Criar cadastro**.
2. Cadastre o e-mail `rafaeldalla@hotmail.com`.
3. Esse endereço recebe automaticamente o perfil administrativo inicial.
4. Entre em **Área administrativa** para administrar usuários, associações, planos e prestações de contas.

## Conferência após a publicação

- Crie um usuário de teste e entre com e-mail e senha.
- Use **Esqueci minha senha** e confira o código recebido.
- Envie mais de um documento de identificação.
- Crie plano de trabalho e prestação de contas com anexos.
- Baixe os PDFs e confira os anexos.
- Confirme no painel administrativo os totais de entrega de mudas por município.

## Segurança

Não envie a chave `BREVO_API_KEY` para o GitHub. Ela deve existir somente em **Variables and Secrets** no painel da Cloudflare.
