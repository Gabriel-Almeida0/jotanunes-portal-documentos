# Portal de Documentação de Terceirizadas — Jotanunes

A Jotanunes cadastra obras, empresas terceirizadas e tipos de documento, convida as empresas por e-mail e
analisa os documentos enviados; cada empresa entra num portal próprio (CNPJ + senha) para enviar os arquivos
e acompanhar a situação.

| Área | Pasta | O que é | Porta local |
|---|---|---|---|
| API | [`backend/`](backend/README.md) | .NET 8 hexagonal + PostgreSQL 16 | `http://localhost:5080` |
| Área Jotanunes | `fluig-app/` | React + Vite, aberta pelo Fluig (token Fluig) ou com login próprio (login + senha) | `http://localhost:5173` |
| Portal da terceirizada | `portal/` | React + Vite, login por CNPJ + senha | `http://localhost:5174` |

Infraestrutura na raiz: [`compose.yaml`](compose.yaml) (Postgres 16), [`.env.example`](.env.example) (nomes das
variáveis, sem segredos) e [`scripts/gerar-token-fluig-dev.mjs`](scripts/gerar-token-fluig-dev.mjs) (token
Fluig de desenvolvimento).

## Documentação

- Como rodar tudo e roteiro de testes ponta a ponta:
  [`specs/001-portal-documentos-terceirizadas/quickstart.md`](specs/001-portal-documentos-terceirizadas/quickstart.md)
- Contrato da API (fonte de verdade entre as três áreas):
  [`specs/001-portal-documentos-terceirizadas/contracts/openapi.yaml`](specs/001-portal-documentos-terceirizadas/contracts/openapi.yaml)
- Guia visual: [`docs/design.md`](docs/design.md)
- Transcrição da conversa com o cliente: [`docs/transcricao.txt`](docs/transcricao.txt)

## Início rápido

```bash
cp .env.example .env            # preencha FLUIG_JWT_SECRET, AUTH_PORTAL_SECRET e AUTH_LOGIN_LOCAL_SECRET
                                # (um diferente para cada: openssl rand -base64 48)
docker compose up -d            # Postgres
set -a; source .env; set +a
export Auth__Fluig__Secret="$FLUIG_JWT_SECRET" Auth__Portal__Secret="$AUTH_PORTAL_SECRET"
export Auth__LoginLocal__Secret="$AUTH_LOGIN_LOCAL_SECRET"      # login próprio da área Jotanunes
export ConnectionStrings__Default="Host=localhost;Port=5432;Database=jotanunes_docs;Username=${POSTGRES_USER:-jotanunes};Password=${POSTGRES_PASSWORD:-jotanunes}"
(cd backend && dotnet run --project src/Jotanunes.Docs.Api)      # API em :5080
node scripts/gerar-token-fluig-dev.mjs --admin dev.admin "Admin Dev" admin@jotanunes.com   # token de administrador (8 h)
node scripts/gerar-token-fluig-dev.mjs dev.analista "Analista Dev" analista@jotanunes.com   # token de usuário comum (8 h)
```

Primeiro administrador do login próprio (uma vez, com as mesmas variáveis exportadas; a senha provisória aparece no
terminal e, em dev sem Resend, também no e-mail que vai para o log da API):

```bash
(cd backend && dotnet run --project src/Jotanunes.Docs.Api -- criar-admin --login dev.admin.local --nome "Admin Local" --email admin.local@jotanunes.com)
```

Depois, entre em `http://localhost:5173` com esse login e a senha provisória (troca obrigatória no primeiro acesso) e
cadastre os outros usuários na tela "Usuários". Rodar de novo sem `--forcar` não muda nada (código 2). Em produção:
`jotanunes-docs-criar-admin ...` na VPS (ver [`deploy/README.md`](deploy/README.md)).

Perfis na área Jotanunes (entrada pelo Fluig): o papel vem só do token Fluig (claim `roles`, ver
[`contracts/fluig-identity.md`](specs/001-portal-documentos-terceirizadas/contracts/fluig-identity.md)). Com `--admin` o
usuário é **administrador** (cadastra, altera e analisa); sem a opção é **comum** (consulta tudo e envia convites).
No login próprio, o papel vem do cadastro do usuário interno (caixa "Administrador" na tela "Usuários").

Os fronts apontam para a API com `VITE_API_URL=http://localhost:5080` (CORS liberado para as portas 5173 e
5174). Sem chave do Resend, os e-mails de convite (link + senha temporária) aparecem no log da API.
