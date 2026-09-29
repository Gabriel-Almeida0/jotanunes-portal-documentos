# Backend — API do Portal de Documentação de Terceirizadas

.NET 8 (ASP.NET Core, Minimal APIs) + EF Core 8 / PostgreSQL 16, em arquitetura hexagonal:

| Projeto | Papel |
|---|---|
| `src/Jotanunes.Docs.Domain` | Entidades e regras (CNPJ, convite, senha, envio). Não referencia nada externo. |
| `src/Jotanunes.Docs.Application` | Casos de uso + **portas** (repositórios, e-mail, arquivos, hash, identidade, auditoria). |
| `src/Jotanunes.Docs.Infrastructure` | **Adaptadores**: EF Core/Npgsql, Resend/log, disco local, BCrypt, JWT do portal. |
| `src/Jotanunes.Docs.Api` | Composição (DI), autenticação (esquemas `Fluig` e `Portal`), endpoints, problem+json. |

O contrato é `../specs/001-portal-documentos-terceirizadas/contracts/openapi.yaml` (fonte de verdade).
O teste `Contrato/ContratoOpenApiTests` falha se uma rota, `operationId`, enum ou propriedade de schema divergir.

## Rodar localmente

Pré-requisitos: .NET SDK 8, Docker, Node 22 (só para o script de token).

```bash
# na raiz do repositório
docker compose up -d                                  # Postgres 16 em localhost:5432
cp .env.example .env                                  # preencha FLUIG_JWT_SECRET e AUTH_PORTAL_SECRET
                                                      # (openssl rand -base64 48 para cada um)
set -a; source .env; set +a
export Auth__Fluig__Secret="$FLUIG_JWT_SECRET" Auth__Portal__Secret="$AUTH_PORTAL_SECRET"
export ConnectionStrings__Default="Host=localhost;Port=5432;Database=jotanunes_docs;Username=${POSTGRES_USER:-jotanunes};Password=${POSTGRES_PASSWORD:-jotanunes}"
# opcional: export Resend__ApiKey="$RESEND_API_KEY" Resend__From="$RESEND_FROM"

cd backend
dotnet run --project src/Jotanunes.Docs.Api           # http://localhost:5080 (aplica as migrations)
curl http://localhost:5080/health                     # {"status":"ok"}
```

- `Properties/launchSettings.json` (perfil `http`) define porta 5080, `ASPNETCORE_ENVIRONMENT=Development`,
  connection string do compose, `Portal__BaseUrl=http://localhost:5174`, `Storage__Root=../../.data/uploads`
  (→ `backend/.data/uploads`, ignorado pelo git), `Cors__Origins=http://localhost:5173,http://localhost:5174`
  e `Database__MigrateOnStartup=true`. **Não contém segredos.**
- Sem `Resend__ApiKey`, os e-mails (convite com link + senha temporária, rejeição) aparecem no **log da API**
  — somente em `Development`. Fora de Development a API não sobe sem `Resend:ApiKey`/`Resend:From`.
- Token Fluig de desenvolvimento: `node scripts/gerar-token-fluig-dev.mjs [login] [nome] [email]` (na raiz).

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
| `RateLimit__PermitLimit` | req/min por IP nas rotas anônimas do portal | `10` |

A API valida no startup: segredos Fluig e Portal com ≥ 32 bytes e diferentes; connection string presente.
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
  (`Autorizacao/*`: esquemas Fluig × Portal e isolamento entre empresas), contrato, desempenho e logs.
  `Infra/ConfiguracaoTestesTests` prova que a API sob teste usa o banco do Testcontainers.

## Migrations

```bash
cd backend
dotnet tool restore
dotnet ef migrations add <Nome> --project src/Jotanunes.Docs.Infrastructure \
  --startup-project src/Jotanunes.Docs.Infrastructure --output-dir Persistencia/Migrations
```

Índices por expressão (`upper(codigo)` em obras, `lower(nome)` em tipos) são criados com SQL na migration
`Inicial`. A migration é aplicada no startup quando `Database__MigrateOnStartup=true`.
