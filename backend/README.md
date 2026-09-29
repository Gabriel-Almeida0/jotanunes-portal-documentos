# Backend — API do Portal de Documentação de Terceirizadas

.NET 8 (ASP.NET Core, Minimal APIs) + EF Core 8 / PostgreSQL 16, em arquitetura hexagonal:

| Projeto | Papel |
|---|---|
| `src/Jotanunes.Docs.Domain` | Entidades e regras (CNPJ, convite, senha, envio). Não referencia nada externo. |
| `src/Jotanunes.Docs.Application` | Casos de uso + **portas** (repositórios, e-mail, arquivos, hash, identidade, auditoria). |
| `src/Jotanunes.Docs.Infrastructure` | **Adaptadores**: EF Core/Npgsql, Resend/log, disco local, BCrypt, JWT do portal. |
| `src/Jotanunes.Docs.Api` | Composição (DI), autenticação (esquemas `Fluig`, `LoginLocal` e `Portal`), endpoints, problem+json, comando `criar-admin`. |

O contrato é `../specs/001-portal-documentos-terceirizadas/contracts/openapi.yaml` (fonte de verdade).
O teste `Contrato/ContratoOpenApiTests` falha se uma rota, `operationId`, enum ou propriedade de schema divergir.

## Rodar localmente

Pré-requisitos: .NET SDK 8, Docker, Node 22 (só para o script de token).

```bash
# na raiz do repositório
docker compose up -d                                  # Postgres 16 em localhost:5432
cp .env.example .env                                  # preencha FLUIG_JWT_SECRET, AUTH_PORTAL_SECRET e
                                                      # AUTH_LOGIN_LOCAL_SECRET (openssl rand -base64 48 para cada um)
set -a; source .env; set +a
export Auth__Fluig__Secret="$FLUIG_JWT_SECRET" Auth__Portal__Secret="$AUTH_PORTAL_SECRET"
export Auth__LoginLocal__Secret="$AUTH_LOGIN_LOCAL_SECRET"
export ConnectionStrings__Default="Host=localhost;Port=5432;Database=jotanunes_docs;Username=${POSTGRES_USER:-jotanunes};Password=${POSTGRES_PASSWORD:-jotanunes}"
# opcional: export Resend__ApiKey="$RESEND_API_KEY" Resend__From="$RESEND_FROM"

cd backend
dotnet run --project src/Jotanunes.Docs.Api           # http://localhost:5080 (aplica as migrations)
curl http://localhost:5080/health                     # {"status":"ok"}
```

- `Properties/launchSettings.json` (perfil `http`) define porta 5080, `ASPNETCORE_ENVIRONMENT=Development`,
  connection string do compose, `Portal__BaseUrl=http://localhost:5174`, `FluigApp__BaseUrl=http://localhost:5173`, `Storage__Root=../../.data/uploads`
  (→ `backend/.data/uploads`, ignorado pelo git), `Cors__Origins=http://localhost:5173,http://localhost:5174`
  e `Database__MigrateOnStartup=true`. **Não contém segredos.**
- Sem `Resend__ApiKey`, os e-mails (convite com link + senha temporária, rejeição) aparecem no **log da API**
  — somente em `Development`. Fora de Development a API não sobe sem `Resend:ApiKey`/`Resend:From`.
- Token Fluig de desenvolvimento (na raiz): `node scripts/gerar-token-fluig-dev.mjs --admin` (administrador,
  `"roles": ["admin"]`) ou `node scripts/gerar-token-fluig-dev.mjs` (usuário comum, sem `roles`); aceita
  `[--admin] [login] [nome] [email]`.
- Perfis (US6): o papel vem só da claim `roles` do token Fluig (`contracts/fluig-identity.md`). As 10 operações
  `x-requer-admin` do contrato têm a política `FluigAdmin`; usuário comum recebe 403 `SEM_PERMISSAO` antes de
  qualquer validação ou leitura, e a tentativa fica na auditoria (`PERMISSAO_NEGADA`, coluna `ator_admin`).
- Login próprio da área Jotanunes (US8–US10, research R17): `POST /api/fluig/auth/login` emite um JWT HS256 próprio
  (`iss=jotanunes-docs`, segredo `Auth__LoginLocal__Secret`, 8 h) com as mesmas claims `sub`/`name`/`email`/`roles` do
  Fluig e mais `uid`, `ver` e `troca_senha`. O esquema seletor `AreaJotanunes` lê o `iss` (sem validar) e manda o token
  para o esquema `LoginLocal` ou `Fluig`, que valida com a própria chave; as rotas `/api/fluig/*` são as mesmas para as
  duas origens. A cada requisição o token local é conferido no banco (usuário ativo, `login = sub`,
  `versao_credencial = ver`): desativar, reativar, mudar o papel, redefinir/trocar a senha e sair revogam na hora. Com
  `troca_senha=true` só respondem `GET /me`, `trocar-senha` e `sair` (o resto → 403 `TROCA_SENHA_OBRIGATORIA`).
  Usuários internos em `/api/fluig/usuarios*` (só administradores, inclusive os GET).
- Catálogo padrão (US7): ao subir, se `tipos_documento` estiver vazia (nenhum tipo, ativo ou inativo), a API cria os
  10 tipos de `data-model.md` §4.1 com autor `sistema`; com qualquer tipo cadastrado não cria nem altera nada.

### Variáveis de ambiente

| Variável | Uso | Dev |
|---|---|---|
| `ConnectionStrings__Default` | Postgres | launchSettings (compose) |
| `Auth__Fluig__Secret` | HS256 do token Fluig (≥ 32 bytes) | = `FLUIG_JWT_SECRET` do `.env` |
| `Auth__Fluig__Issuer` / `Auth__Fluig__Audience` | claims do token Fluig | `fluig` / `jotanunes-docs-api` |
| `Auth__Portal__Secret` | HS256 do token do portal (≥ 32 bytes, ≠ Fluig) | = `AUTH_PORTAL_SECRET` |
| `Resend__ApiKey` / `Resend__From` | envio de e-mail | vazio (e-mail no log) |
| `Portal__BaseUrl` | links dos e-mails | `http://localhost:5174` |
| `Storage__Root` | pasta dos arquivos (relativa à raiz de conteúdo da API) | `../../.data/uploads` |
| `Cors__Origins` | origens permitidas (separadas por vírgula) | `http://localhost:5173,http://localhost:5174` |
| `Database__MigrateOnStartup` | aplica migrations ao subir | `true` |
| `Catalogo__SemearTiposPadrao` | cria o catálogo padrão de 10 tipos ao subir, só se não houver nenhum tipo (roda depois das migrations ou sozinho, quando elas são aplicadas por script) | `true` (padrão do `appsettings.json`) |
| `RateLimit__PermitLimit` | req/min por IP nas rotas anônimas do portal e no login próprio (mesmo balde) | `10` |
| `Auth__LoginLocal__Habilitado` | liga o login próprio da área Jotanunes; `false` → login/trocar-senha/sair 404, tokens locais 401 | `true` (padrão) |
| `Auth__LoginLocal__Secret` | HS256 do token do login próprio (≥ 32 bytes, ≠ Fluig e ≠ Portal); obrigatório com o login ligado | = `AUTH_LOGIN_LOCAL_SECRET` |
| `FluigApp__BaseUrl` | endereço da área Jotanunes nos e-mails de acesso (obrigatório fora de Development com o login ligado) | `http://localhost:5173` |

A API valida no startup: segredos Fluig e Portal com ≥ 32 bytes e diferentes; com o login próprio ligado, segredo
`Auth__LoginLocal__Secret` com ≥ 32 bytes e diferente dos outros dois e `FluigApp__BaseUrl` fora de Development;
`Auth__Fluig__Issuer` nunca igual a `jotanunes-docs`; connection string presente.

### Primeiro administrador: comando `criar-admin`

```bash
# desenvolvimento (em backend/, com as variáveis acima exportadas)
dotnet run --project src/Jotanunes.Docs.Api -- criar-admin --login ana.souza --nome "Ana Souza" --email ana.souza@jotanunes.com
# API publicada (mesmo ambiente do serviço; em produção use o atalho jotanunes-docs-criar-admin, ver deploy/README.md)
dotnet Jotanunes.Docs.Api.dll criar-admin --login ana.souza --nome "Ana Souza" --email ana.souza@jotanunes.com [--forcar]
```

Roda com a mesma configuração e validação da API (aplica as migrations se `Database__MigrateOnStartup=true`) e **não**
sobe o servidor HTTP. Sob bloqueio exclusivo no banco: sem administrador interno ativo, cria o login novo (ou, se o login
já existe, torna-o administrador ativo com nova senha provisória, `versao_credencial + 1`); com administrador ativo e sem
`--forcar`, não muda nada. A senha provisória (12 caracteres, 7 dias, troca obrigatória no primeiro acesso) é escrita
**só no terminal** (stdout) e no e-mail de acesso — nunca no `ILogger`. Auditoria `USUARIO_CRIADO`/`SENHA_REDEFINIDA`
com `ator_tipo=SISTEMA`.

| Código de saída | Significado |
|---|---|
| `0` | administrador criado ou recuperado (também se o e-mail falhar: aviso no stderr, a senha está no terminal) |
| `1` | argumentos inválidos (uso no stderr) ou login próprio desligado (`Auth__LoginLocal__Habilitado=false`) |
| `2` | já existe administrador interno ativo e não foi usado `--forcar`; nada foi alterado |
Toda configuração é lida de forma preguiçosa (IOptions/IConfiguration do container), então variáveis de
ambiente e overrides de teste sempre valem.

## Testes

```bash
cd backend
dotnet test                                   # Domain + Application + Api (Testcontainers sobe um Postgres próprio)
dotnet test --filter "Categoria!=Desempenho"  # sem o teste de volume (SC-006)
```

- `Jotanunes.Docs.Domain.Tests`: regras de domínio + teste de arquitetura (dependências entre camadas).
- `Jotanunes.Docs.Application.Tests`: detector de formato, situação do documento, adaptador Resend.
- `Jotanunes.Docs.Api.Tests`: integração ponta a ponta com Postgres real (Docker obrigatório), autorização
  (`Autorizacao/*`: esquemas Fluig × login próprio × Portal, revogação do token local, isolamento entre empresas e
  perfis administrador × comum — o `PerfilAdminTests` percorre todas as rotas `/api/fluig/*`, com token do Fluig e do
  login próprio, e falha se aparecer rota de escrita sem classificação), login próprio (`AcessoJotanunes/*`), usuários
  internos e o comando `criar-admin` (`UsuariosInternos/*`),
  contrato, desempenho e logs. A `ApiFactory` desliga o catálogo padrão (`Catalogo:SemearTiposPadrao=false`); os
  testes de `TiposDocumento/CatalogoPadraoTests` ligam com `ApiFactory.ComCatalogoPadrao()`.
  `Infra/ConfiguracaoTestesTests` prova que a API sob teste usa o banco do Testcontainers.

## Migrations

```bash
cd backend
dotnet tool restore
dotnet ef migrations add <Nome> --project src/Jotanunes.Docs.Infrastructure \
  --startup-project src/Jotanunes.Docs.Infrastructure --output-dir Persistencia/Migrations
```

Índices por expressão (`upper(codigo)` em obras, `lower(nome)` em tipos) são criados com SQL na migration
`Inicial`; `lower(login)` em `usuarios_internos`, na migration `UsuariosInternos`. A migration é aplicada no startup quando `Database__MigrateOnStartup=true`.
