# Quickstart — Portal de Documentação de Terceirizadas Jotanunes

Guia para subir o ambiente local e validar a feature de ponta a ponta. Detalhes de rotas e schemas
em [`contracts/openapi.yaml`](contracts/openapi.yaml); regras de dados em
[`data-model.md`](data-model.md).

## 1. Pré-requisitos

- Docker (com `docker compose`), .NET SDK 8, Node 22.
- Portas livres: 5432 (Postgres), 5080 (API), 5173 (`fluig-app`), 5174 (`portal`).

## 2. Configuração

```bash
cp .env.example .env                       # raiz: FLUIG_JWT_SECRET, POSTGRES_*
# gere segredos (32+ bytes) para FLUIG_JWT_SECRET e AUTH_PORTAL_SECRET no .env:
openssl rand -base64 48
```

A API lê a configuração das variáveis de ambiente (ver tabela em [`plan.md`](plan.md#configuração-variáveis-de-ambiente)).
Em dev, `backend/src/Jotanunes.Docs.Api/Properties/launchSettings.json` aponta para o Postgres do
compose e **não** contém segredos. Antes do `dotnet run`, exporte os segredos no mesmo shell
(o `.env` da raiz não é lido pela API):

```bash
set -a; source .env; set +a
export Auth__Fluig__Secret="$FLUIG_JWT_SECRET" Auth__Portal__Secret="$AUTH_PORTAL_SECRET"
export ConnectionStrings__Default="Host=localhost;Port=5432;Database=jotanunes_docs;Username=${POSTGRES_USER:-jotanunes};Password=${POSTGRES_PASSWORD:-jotanunes}"
export Resend__ApiKey="$RESEND_API_KEY" Resend__From="$RESEND_FROM"   # opcionais
```

Sem `Resend__ApiKey`, os e-mails aparecem no log da API (somente em Development).

## 3. Subir

```bash
docker compose up -d                                   # Postgres 16
cd backend && dotnet run --project src/Jotanunes.Docs.Api   # http://localhost:5080 (aplica migrations)
cd fluig-app && npm install && npm run dev             # http://localhost:5173
cd portal && npm install && npm run dev                # http://localhost:5174
node scripts/gerar-token-fluig-dev.mjs dev.analista "Analista Dev" analista@jotanunes.com
```

Coloque o token gerado em `fluig-app/.env.local` (`VITE_FLUIG_DEV_TOKEN=...`) ou abra
`http://localhost:5173/#fluigToken=<token>`.

Checagem rápida: `curl http://localhost:5080/health` → `{"status":"ok"}`.

## 4. Testes automatizados

```bash
cd backend && dotnet test               # unitários + integração (Testcontainers sobe Postgres próprio)
cd fluig-app && npm test                # Vitest + Testing Library (MSW)
cd portal && npm test
```

Esperado: todos verdes; a suíte `Autorizacao*` do backend cobre isolamento entre empresas e
separação dos esquemas Fluig/portal (SC-003, SC-008).

## 5. Frontends sem backend (mocks do contrato)

```bash
VITE_USE_MOCKS=true npm run dev         # em fluig-app/ ou portal/
```

Os handlers MSW em `src/mocks/` respondem conforme o `openapi.yaml`. No portal, o mock aceita
CNPJ `12.345.678/0001-95` com senha `Temp1234` (troca obrigatória) e depois `Nova1234`.

## 6. Roteiro E2E manual (critérios de aceite)

Use um navegador com o `fluig-app` (token de dev) e outro perfil/aba anônima com o `portal`.

| # | Passo | Resultado esperado | Cobre |
|---|---|---|---|
| 1 | Abrir `http://localhost:5173` **sem** token | "Abra este sistema pelo Fluig." e nenhum dado | US1-2, FR-002 |
| 2 | Abrir com token de dev | Painel com o nome "Analista Dev", sem tela de login | US1-1, FR-001 |
| 3 | Tipos de documento → cadastrar "Cartão CNPJ", "CND Federal", "PCMSO" | 3 tipos ativos | US1, FR-014 |
| 4 | Obras → cadastrar "Residencial Vista do Rio", Aracaju/SE | Obra listada | FR-010 |
| 5 | Empresas → cadastrar "Alfa Engenharia Ltda", CNPJ `11.222.333/0001-81`, e-mail `contato@alfa.test` | Acesso "Não convidada"; 0 de 3 aprovados | US1-3, FR-011 |
| 6 | Repetir o cadastro com CNPJ `11222333000181` | Erro "Já existe uma empresa com este CNPJ." | US1-4 |
| 7 | Cadastrar "Beta Serviços" com CNPJ alfanumérico válido (ex.: `12.ABC.345/01DE-35`) e e-mail `contato@beta.test`; tentar outro com DV errado | O válido é salvo; o inválido é recusado no campo CNPJ | US1-5, FR-012 |
| 8 | Obra → vincular Alfa e Beta; vincular Alfa de novo | Duas empresas na obra, sem duplicar | US1-6, FR-013 |
| 9 | Empresa Alfa → "Enviar convite" | Acesso "Convidada"; no log da API: e-mail com link `http://localhost:5174/acesso?convite=...`, obra vinculada e senha temporária | US2-1, FR-020 |
| 10 | Abrir o link do convite no portal | Tela "Acesse o portal de documentos" com CNPJ preenchido | US2-2 |
| 11 | Entrar com CNPJ + senha temporária | Tela "Crie uma nova senha para continuar."; tentar navegar para `/documentos` volta para a troca | US2-3, FR-004 |
| 12 | Tentar nova senha `abc` | Mensagem de senha fraca | FR-007 |
| 13 | Criar senha `Alfa2026ok` | Vai para "Meus documentos": 3 documentos "Pendente de envio" | US2-3, US3-1 |
| 14 | Sair e entrar com a senha temporária | "CNPJ ou senha incorretos." | US2-4 |
| 15 | Entrar com a senha nova; enviar um `.pdf` válido para "Cartão CNPJ" | Situação "Em análise" com nome do arquivo e data | US3-2, FR-031 |
| 16 | Tentar enviar um `.exe` renomeado para `.pdf` e um PDF de 11 MB | Recusados: "Envie um arquivo PDF, JPG ou PNG." / "O arquivo passa de 10 MB." | US3-3, FR-032/033 |
| 17 | "Cartão CNPJ" em análise | Sem botão de envio | US3-4 |
| 18 | Clicar no nome do arquivo | Download do próprio arquivo | US3-7, FR-034 |
| 19 | Convidar Beta, fazer o primeiro acesso e, com o token da Beta, chamar `GET /api/portal/envios/{id do envio da Alfa}/arquivo` (DevTools/curl) | 404 | US3-5, FR-035 |
| 20 | Chamar `GET /api/fluig/obras` com o token do portal e `GET /api/portal/documentos` com o token Fluig | 401 nos dois | FR-002/003 |
| 21 | fluig-app → Fila de análise | Envio da Alfa listado (mais antigo primeiro); abrir arquivo funciona | US4-1/2, FR-040/041 |
| 22 | Rejeitar sem motivo; depois com motivo "Documento ilegível, envie de novo" | Primeiro recusado; depois "Rejeitado"; no log: e-mail de rejeição para a Alfa | US4-4/5, FR-042/045 |
| 23 | Portal da Alfa → recarregar | "Rejeitado" + motivo + "Enviar novo arquivo"; reenviar → "Em análise" | US4-6, SC-004 |
| 24 | fluig-app → aprovar o novo envio; abrir histórico da Alfa | 2 envios: aprovado (analista, data) e rejeitado (analista, data, motivo) | US4-3/8, SC-005 |
| 25 | Em duas abas do fluig-app, aprovar o mesmo envio em análise | A segunda recebe "Este envio já foi analisado." | US4-7, FR-044 |
| 26 | Portal: 5 senhas erradas e uma 6ª tentativa | Bloqueio por 15 minutos | US2-7, FR-006 |
| 27 | fluig-app → reenviar convite da Alfa | Sessão atual do portal da Alfa cai (401); nova senha temporária no log; troca obrigatória de novo | US2-6, FR-022 |
| 28 | Desativar a Beta e tentar entrar no portal com ela | Acesso recusado ("Esta empresa está desativada.") | US2-8 |
| 29 | Cadastrar novo tipo "NR-35" | Aparece "Pendente de envio" para Alfa e Beta (se ativa) | FR-015 |
| 30 | Painel e detalhe da obra | Contagens batem com os passos anteriores | US5, FR-050/051 |

## 7. Verificações visuais

- Montserrat carregada; botões primários `#DF1A1A`, links `#BD1E1B`, títulos com barra vermelha
  50×6 px; painel de login do portal com canto `20px 0`.
- Selos de situação sempre com texto (Pendente de envio / Em análise / Aprovado / Rejeitado) nas
  cores de `docs/design.md` §3.4.
- `fluig-app` sem cabeçalho de marca; portal com cabeçalho `#F2F2F2`, logo, razão social e "Sair".
- Em 360 px de largura: sem rolagem horizontal da página no portal; tabelas do `fluig-app` com
  rolagem interna.
- Contraste: conferir no DevTools (Lighthouse/axe) — nenhum alerta de contraste (SC-007).
