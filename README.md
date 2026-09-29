# Portal de Documentação de Terceirizadas — Jotanunes

A Jotanunes cadastra obras, empresas terceirizadas e tipos de documento, convida as empresas por e-mail e
analisa os documentos enviados; cada empresa entra num portal próprio (CNPJ + senha) para enviar os arquivos
e acompanhar a situação.

| Área | Pasta | O que é | Porta local |
|---|---|---|---|
| API | [`backend/`](backend/README.md) | .NET 8 hexagonal + PostgreSQL 16 | `http://localhost:5080` |
| Área Jotanunes | `fluig-app/` | React + Vite, aberta de dentro do Fluig (token Fluig) | `http://localhost:5173` |
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
cp .env.example .env            # preencha FLUIG_JWT_SECRET e AUTH_PORTAL_SECRET (openssl rand -base64 48)
docker compose up -d            # Postgres
set -a; source .env; set +a
export Auth__Fluig__Secret="$FLUIG_JWT_SECRET" Auth__Portal__Secret="$AUTH_PORTAL_SECRET"
export ConnectionStrings__Default="Host=localhost;Port=5432;Database=jotanunes_docs;Username=${POSTGRES_USER:-jotanunes};Password=${POSTGRES_PASSWORD:-jotanunes}"
(cd backend && dotnet run --project src/Jotanunes.Docs.Api)      # API em :5080
node scripts/gerar-token-fluig-dev.mjs --admin dev.admin "Admin Dev" admin@jotanunes.com   # token de administrador (8 h)
node scripts/gerar-token-fluig-dev.mjs dev.analista "Analista Dev" analista@jotanunes.com   # token de usuário comum (8 h)
```

Perfis na área Jotanunes: o papel vem só do token Fluig (claim `roles`, ver
[`contracts/fluig-identity.md`](specs/001-portal-documentos-terceirizadas/contracts/fluig-identity.md)). Com `--admin` o
usuário é **administrador** (cadastra, altera e analisa); sem a opção é **comum** (consulta tudo e envia convites).

Os fronts apontam para a API com `VITE_API_URL=http://localhost:5080` (CORS liberado para as portas 5173 e
5174). Sem chave do Resend, os e-mails de convite (link + senha temporária) aparecem no log da API.
