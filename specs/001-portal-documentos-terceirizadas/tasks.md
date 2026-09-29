---

description: "Lista de tarefas — Portal de Documentação de Terceirizadas Jotanunes"
---

# Tasks: Portal de Documentação de Terceirizadas Jotanunes

**Input**: Design documents from `/specs/001-portal-documentos-terceirizadas/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml,
contracts/fluig-identity.md, quickstart.md

**Tests**: INCLUÍDOS — exigidos pela constituição (princípio IV) e pelo pedido do usuário: xUnit no
backend; Vitest + Testing Library nos fronts. Escreva o teste antes e veja falhar.

**Organization**: tarefas agrupadas por user story; dentro de cada fase, subdivididas por área.

## Format: `[ID] [P?] [Story] [ÁREA] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência de tarefa incompleta)
- **[Story]**: US1…US10 (só nas fases de user story; US6/US7 na Phase 10; US8/US9/US10 na Phase 11)
- **[ÁREA]** (obrigatória em TODA tarefa): `[BACKEND]` só edita `backend/`; `[FLUIG]` só edita
  `fluig-app/`; `[PORTAL]` só edita `portal/`; `[INFRA]` só edita arquivos da raiz
  (`compose.yaml`, `.env.example`, `.gitignore`, `README.md`, `scripts/`, `docs/`, `deploy/`).
  Nenhuma tarefa exige editar arquivos de outra área.

## Regras para os 3 agentes paralelos

1. **Fonte de verdade**: `specs/001-portal-documentos-terceirizadas/contracts/openapi.yaml`. Nenhum
   agente edita o contrato; divergência encontrada → parar e reportar ao orquestrador.
2. **FLUIG/PORTAL** trabalham com MSW (`VITE_USE_MOCKS=true`) cujas respostas seguem o contrato; não
   esperam o backend. A integração real é validada no roteiro E2E do `quickstart.md`.
3. **BACKEND** valida com Testcontainers (Postgres real); não depende dos fronts.
4. Visual: `docs/design.md` (tokens `--jn-*`, Montserrat, `20px 0`, status com texto, WCAG AA).
   Proibido qualquer framework/biblioteca de CSS ou de componentes visuais.
5. Mensagens ao usuário: usar os `title` da tabela `CodigoErro` do contrato (português, tom de voz
   de `docs/design.md` §9).

## Path Conventions

- Backend: `backend/src/Jotanunes.Docs.{Domain,Application,Infrastructure,Api}/`,
  `backend/tests/Jotanunes.Docs.{Domain,Application,Api}.Tests/`
- Área Jotanunes: `fluig-app/src/`
- Portal: `portal/src/`
- Testes de front ficam ao lado do arquivo (`*.test.ts(x)`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: esqueleto das três áreas + infraestrutura local.

### INFRA

- [X] T001 [INFRA] Criar `compose.yaml` com serviço `postgres` (`postgres:16-alpine`), `POSTGRES_DB=jotanunes_docs`, usuário/senha de `${POSTGRES_USER:-jotanunes}`/`${POSTGRES_PASSWORD:-jotanunes}`, porta `5432:5432`, volume nomeado `pgdata` e healthcheck `pg_isready`
- [X] T002 [P] [INFRA] Criar `.env.example` na raiz com `POSTGRES_USER`, `POSTGRES_PASSWORD`, `FLUIG_JWT_SECRET`, `AUTH_PORTAL_SECRET`, `RESEND_API_KEY`, `RESEND_FROM` (sem valores secretos) e acrescentar `backend/.data/` e `*.local` ao `.gitignore`
- [X] T003 [P] [INFRA] Criar `scripts/gerar-token-fluig-dev.mjs` (Node puro, `node:crypto`): lê `FLUIG_JWT_SECRET` do ambiente ou do `.env` da raiz, aceita `[login] [nome] [email]` (padrão `dev.analista`, `Analista Dev`, `analista@jotanunes.com`), emite JWT HS256 com `iss=fluig`, `aud=jotanunes-docs-api`, `exp=iat+8h` conforme `contracts/fluig-identity.md` e imprime o token
- [X] T004 [P] [INFRA] Criar `README.md` na raiz: visão geral das 3 áreas, links para `docs/design.md`, `docs/transcricao.txt` e `specs/001-portal-documentos-terceirizadas/quickstart.md`

### BACKEND

- [X] T005 [BACKEND] Criar `backend/Jotanunes.Docs.sln` com `src/Jotanunes.Docs.Domain`, `src/Jotanunes.Docs.Application`, `src/Jotanunes.Docs.Infrastructure`, `src/Jotanunes.Docs.Api` (web), `tests/Jotanunes.Docs.Domain.Tests`, `tests/Jotanunes.Docs.Application.Tests`, `tests/Jotanunes.Docs.Api.Tests` (xUnit); referências: Application→Domain, Infrastructure→Application, Api→Infrastructure+Application; `backend/Directory.Build.props` (net8.0, `Nullable=enable`, `TreatWarningsAsErrors=true`) e `backend/.gitignore` (`.data/`)
- [X] T006 [BACKEND] Adicionar pacotes: Infrastructure (`Npgsql.EntityFrameworkCore.PostgreSQL` 8, `EFCore.NamingConventions` 8, `BCrypt.Net-Next` 4, `Microsoft.EntityFrameworkCore.Design` 8), Api (`Microsoft.AspNetCore.Authentication.JwtBearer` 8), testes (`Microsoft.AspNetCore.Mvc.Testing` 8, `Testcontainers.PostgreSql`, `Microsoft.Extensions.TimeProvider.Testing`, `Microsoft.OpenApi.Readers`) e ferramenta local `dotnet-ef` em `backend/.config/dotnet-tools.json`
- [X] T007 [P] [BACKEND] Teste de arquitetura em `backend/tests/Jotanunes.Docs.Domain.Tests/ArquiteturaTests.cs`: o assembly `Domain` não referencia `Application`, `Infrastructure`, `Api`, `Microsoft.EntityFrameworkCore` nem `Microsoft.AspNetCore`; `Application` não referencia `Infrastructure`/`Api`/EF Core

### FLUIG

- [X] T008 [P] [FLUIG] Criar projeto Vite React TS em `fluig-app/` (`package.json` com scripts `dev` na porta 5173, `build`, `test` = `vitest run`, `gen:api`; `tsconfig.json` strict; `vite.config.ts` com bloco `test` usando `jsdom` e `src/test/setup.ts`; `.env.example` com `VITE_API_URL=http://localhost:5080`, `VITE_USE_MOCKS=false`, `VITE_FLUIG_DEV_TOKEN=`)
- [X] T009 [P] [FLUIG] Instalar `react-router-dom` 6 e, como dev, `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, `msw` 2, `openapi-typescript` 7; criar `fluig-app/src/test/setup.ts` (jest-dom + servidor MSW `listen/resetHandlers/close`)

### PORTAL

- [X] T010 [P] [PORTAL] Criar projeto Vite React TS em `portal/` (`package.json` com scripts `dev` na porta 5174, `build`, `test` = `vitest run`, `gen:api`; `tsconfig.json` strict; `vite.config.ts` com bloco `test` usando `jsdom` e `src/test/setup.ts`; `.env.example` com `VITE_API_URL=http://localhost:5080`, `VITE_USE_MOCKS=false`)
- [X] T011 [P] [PORTAL] Instalar `react-router-dom` 6 e, como dev, `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, `msw` 2, `openapi-typescript` 7; criar `portal/src/test/setup.ts` (jest-dom + servidor MSW)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: modelo de dados, autenticação, erros, cliente da API e componentes base.

**⚠️ CRITICAL**: nenhuma user story começa antes do fim desta fase **na mesma área** (cada área pode
seguir para as stories assim que a sua parte da Fase 2 terminar).

### BACKEND — Domínio e persistência

- [X] T012 [P] [BACKEND] Testes do value object CNPJ em `backend/tests/Jotanunes.Docs.Domain.Tests/Empresas/CnpjTests.cs`: aceita `12.345.678/0001-95`, `11222333000181` e alfanumérico `12.ABC.345/01DE-35`; normaliza para 14 caracteres maiúsculos sem máscara; recusa DV errado, 14 caracteres iguais, tamanho ≠ 14 e letras nas 2 posições do DV (research R9)
- [X] T013 [P] [BACKEND] Implementar `Cnpj` (DV módulo 11, valor do caractere = ASCII − 48, pesos 5..2,9..2 / 6..2,9..2), `Email` (minúsculas, máx. 254) e enum `Uf` (27 UFs) em `backend/src/Jotanunes.Docs.Domain/Empresas/Cnpj.cs`, `backend/src/Jotanunes.Docs.Domain/Comum/Email.cs`, `backend/src/Jotanunes.Docs.Domain/Obras/Uf.cs`, mais `ErroDominio` em `backend/src/Jotanunes.Docs.Domain/Comum/ErroDominio.cs`
- [X] T014 [BACKEND] Criar entidades com os campos de `data-model.md` (sem comportamento ainda) em `backend/src/Jotanunes.Docs.Domain/`: `Obras/Obra.cs`, `Empresas/Empresa.cs` (incluindo `senha_hash`, `troca_senha_obrigatoria`, `senha_temporaria_expira_em`, `versao_credencial`, `tentativas_falhas`, `bloqueado_ate`, `ultimo_acesso_em`), `Obras/ObraEmpresa.cs`, `TiposDocumento/TipoDocumento.cs`, `Convites/Convite.cs`, `Envios/EnvioDocumento.cs`, `Envios/StatusEnvio.cs`, `Auditoria/RegistroAuditoria.cs`
- [X] T015 [BACKEND] Criar `DocsDbContext` e configurações EF em `backend/src/Jotanunes.Docs.Infrastructure/Persistencia/` com snake_case e as restrições de `data-model.md`: tamanhos (`nome varchar(150)`, `razao_social varchar(200)`, `cnpj char(14)` UNIQUE, `email_contato varchar(254)`, `nome varchar(120)` do tipo, `instrucoes varchar(1000)`, `motivo_rejeicao varchar(500)`, `token_hash char(64)` UNIQUE, `sha256 char(64)`, `chave_armazenamento varchar(300)`), `timestamptz`, enums como texto, PK composta `obra_empresas(obra_id, empresa_id)`, índices únicos `upper(codigo)` (obras, quando não nulo) e `lower(nome)` (tipos), índices `(empresa_id, tipo_documento_id, enviado_em desc)` e `(status, enviado_em)` e **único parcial** `envios_documento(empresa_id, tipo_documento_id) WHERE status <> 'REJEITADO'`
- [X] T016 [BACKEND] Gerar migration inicial `Inicial` em `backend/src/Jotanunes.Docs.Infrastructure/Persistencia/Migrations/` e aplicar no startup quando `Database:MigrateOnStartup=true`

### BACKEND — Aplicação, API e autenticação

- [X] T017 [P] [BACKEND] Criar `CodigoErro` (mesmos valores do enum `CodigoErro` do contrato) e `ErroAplicacao(CodigoErro, detalhe?, errosPorCampo?)` em `backend/src/Jotanunes.Docs.Application/Erros/`, e DTO `Pagina<T>(itens, total, pagina, tamanhoPagina)` com validação `pagina ≥ 1`, `tamanhoPagina 1–100` (padrão 20) em `backend/src/Jotanunes.Docs.Application/Comum/Pagina.cs`
- [X] T018 [P] [BACKEND] Declarar portas em `backend/src/Jotanunes.Docs.Application/Portas/`: `IUnidadeTrabalho`, repositórios (`IObraRepositorio`, `IEmpresaRepositorio`, `ITipoDocumentoRepositorio`, `IConviteRepositorio`, `IEnvioRepositorio`), `IConsultaDocumentos` (situação/contagem por empresa), `IUsuarioFluigAtual`, `IEmpresaPortalAtual`, `IHasherSenha`, `IGeradorSegredos`, `IEmissorTokenPortal`, `IEnviadorEmail`, `IArmazenamentoArquivos`, `IRegistroAuditoria`, `IContextoRequisicao` (IP da requisição); usar `TimeProvider` para relógio
- [X] T019 [P] [BACKEND] Implementar `RegistroAuditoriaEf` (grava em `auditoria` na mesma transação; `ip` obtido da porta `IContextoRequisicao`, implementada na `Api` a partir do `HttpContext`; nunca recebe senha/token/conteúdo) e `UnidadeTrabalhoEf` em `backend/src/Jotanunes.Docs.Infrastructure/`
- [X] T020 [BACKEND] Montar `backend/src/Jotanunes.Docs.Api/Program.cs`: DI das camadas, JSON camelCase com enums string, CORS de `Cors:Origins` (sem credenciais), `TimeProvider.System`, handler global que converte `ErroAplicacao` em `application/problem+json` com `code`, `title` (tabela `CodigoErro` do contrato), `status`, `errors`, `traceId`, e exceções não tratadas em `ERRO_INTERNO` 500 sem stack trace; endpoint `GET /health` → `{"status":"ok"}`; `appsettings.json`/`appsettings.Development.json` sem segredos
- [X] T021 [BACKEND] Esquema de autenticação `Fluig` (JwtBearer HS256: `Auth:Fluig:Secret/Issuer/Audience`, `ClockSkew` 2 min, só `HS256`, rejeitar `exp − iat > 8h` e `sub`/`name` vazios), política `Fluig` e adaptador `UsuarioFluigAtualDeClaims : IUsuarioFluigAtual` em `backend/src/Jotanunes.Docs.Api/Autenticacao/`; endpoint `GET /api/fluig/me` em `backend/src/Jotanunes.Docs.Api/Endpoints/Fluig/SessaoEndpoints.cs`
- [X] T022 [BACKEND] Esquema de autenticação `Portal` (JwtBearer HS256: `Auth:Portal:Secret`, `iss=aud=jotanunes-docs-portal`), políticas `Portal` e `PortalCompleto` (exige claim `troca_senha=false`; falha → 403 `TROCA_SENHA_OBRIGATORIA`) e adaptador `EmpresaPortalAtualDeClaims : IEmpresaPortalAtual` em `backend/src/Jotanunes.Docs.Api/Autenticacao/`; 401 de qualquer esquema → problem `NAO_AUTENTICADO`
- [X] T023 [BACKEND] Validar configuração no startup em `backend/src/Jotanunes.Docs.Api/Configuracao/ValidacaoConfiguracao.cs`: segredos Fluig e Portal com ≥ 32 bytes e diferentes entre si; fora de Development exigir `Resend:ApiKey` e `Resend:From`
- [X] T024 [BACKEND] Infraestrutura de testes em `backend/tests/Jotanunes.Docs.Api.Tests/Infra/`: `ApiFactory` (WebApplicationFactory + Testcontainers Postgres 16 + migrations), `FakeTimeProvider`, `EnviadorEmailFake` (guarda mensagens), armazenamento em diretório temporário, `Tokens` (gera token Fluig e token Portal válidos, expirados, com segredo errado, com `alg=none`) e `Semente` (helpers para criar obras/empresas/tipos/envios direto no banco)
- [X] T025 [P] [BACKEND] Testes de autenticação em `backend/tests/Jotanunes.Docs.Api.Tests/Autorizacao/EsquemasTests.cs`: `GET /health` 200 sem token; `GET /api/fluig/me` → 200 com token Fluig válido (devolve login/nome/email), 401 sem token, com token expirado, segredo errado, `iss`/`aud` errados, `alg=none`, validade > 8 h e **token do portal**

### FLUIG — Base do app

- [X] T026 [P] [FLUIG] Criar `fluig-app/src/styles/tokens.css` (cópia dos tokens de `docs/design.md` §10, declarados em `.jn-app` em vez de `:root`) e `fluig-app/src/styles/base.css` (reset mínimo escopado em `.jn-app`, foco visível, fonte `--jn-font`); `<link>` do Montserrat 400/500/600 em `fluig-app/index.html`
- [X] T027 [P] [FLUIG] Gerar `fluig-app/src/api/schema.d.ts` com `openapi-typescript ../specs/001-portal-documentos-terceirizadas/contracts/openapi.yaml` (script `gen:api`) e criar `fluig-app/src/api/client.ts`: base `VITE_API_URL`, header `Authorization: Bearer <fluigToken>`, JSON tipado pelos `paths`, conversão de `application/problem+json` em `ErroApi { status, code, title, errors }`, evento de "não autenticado" em 401, e `baixarArquivo(url)` (fetch → Blob → `URL.createObjectURL`)
- [X] T028 [FLUIG] Criar `fluig-app/src/auth/tokenFluig.ts` + `fluig-app/src/auth/AuthFluigProvider.tsx`: lê `#fluigToken=` do fragmento e remove com `history.replaceState`, senão `sessionStorage['jn.fluigToken']`, senão (só em `import.meta.env.DEV`) `VITE_FLUIG_DEV_TOKEN`; chama `GET /api/fluig/me`; sem token ou 401 → página `fluig-app/src/pages/AcessoNegado.tsx` com "Abra este sistema pelo Fluig." e nenhum dado
- [X] T029 [P] [FLUIG] Testes em `fluig-app/src/auth/AuthFluigProvider.test.tsx`: token no fragmento é usado e removido da URL; sem token → "Abra este sistema pelo Fluig."; 401 do `/me` → mesma tela; token válido → nome do usuário visível
- [X] T030 [P] [FLUIG] Configurar MSW em `fluig-app/src/mocks/` (`browser.ts`, `server.ts`, `dados.ts` com fixtures em memória conformes aos schemas do contrato, `handlers/sessao.ts` para `/api/fluig/me` e `/api/fluig/painel`) e ligar no `fluig-app/src/main.tsx` quando `VITE_USE_MOCKS=true`
- [X] T031 [P] [FLUIG] Criar componentes base em `fluig-app/src/components/` com CSS próprio (`*.css`, classes `jn-`): `Botao` (primário `--jn-red-500`, hover `--jn-red-700`, secundário contornado, raio 3 px), `Campo` (rótulo acima, borda `#666`, mensagem de erro), `Selo` (situação com texto + cores de `docs/design.md` §3.4), `TituloPagina` (barra vermelha 50×6 px), `Tabela` (rolagem horizontal interna), `Paginacao`, `ModalConfirmacao`, `Filtros` (padrão "Encontre seu Jota"), `icons/` (SVG inline)
- [X] T032 [P] [FLUIG] Testes em `fluig-app/src/components/Selo.test.tsx` e `fluig-app/src/components/Campo.test.tsx`: cada situação (`PENDENTE_ENVIO`, `EM_ANALISE`, `APROVADO`, `REJEITADO`, e situações de acesso) renderiza texto em português; campo associa rótulo ao input e mostra erro com `aria-describedby`
- [X] T033 [FLUIG] Criar `fluig-app/src/App.tsx` com `HashRouter`, raiz `<div class="jn-app">`, layout com menu lateral (Painel, Obras, Empresas, Tipos de documento, Fila de análise; ativo em `--jn-red-700` com barra de 3 px), **sem** cabeçalho de marca, e rotas já ligadas a componentes provisórios (um arquivo por página em `fluig-app/src/pages/`: `Painel`, `Obras`, `ObraDetalhe`, `Empresas`, `EmpresaDetalhe`, `TiposDocumento`, `FilaAnalise`, `EnvioAnalise`, cada um exportando um placeholder com `TituloPagina`); as tarefas das stories substituem o conteúdo desses arquivos sem precisar editar `App.tsx`
- [X] T034 [P] [FLUIG] Criar utilitários em `fluig-app/src/utils/`: `cnpj.ts` (máscara `XX.XXX.XXX/XXXX-XX`, normalização e validação de DV numérico/alfanumérico idêntica à research R9), `datas.ts` (formatação em `America/Sao_Paulo`), com testes `cnpj.test.ts` usando `12.345.678/0001-95`, `11.222.333/0001-81` e `12.ABC.345/01DE-35`

### PORTAL — Base do app

- [X] T035 [P] [PORTAL] Criar `portal/src/styles/tokens.css` (tokens de `docs/design.md` §10 em `:root`) e `portal/src/styles/base.css`; `<link>` do Montserrat 400/500/600 em `portal/index.html`; copiar `docs/design-referencias/logo-jotanunes.png` para `portal/src/assets/logo-jotanunes.png`
- [X] T036 [P] [PORTAL] Gerar `portal/src/api/schema.d.ts` com `openapi-typescript ../specs/001-portal-documentos-terceirizadas/contracts/openapi.yaml` (script `gen:api`) e criar `portal/src/api/client.ts`: base `VITE_API_URL`, Bearer do token do portal, conversão de problem em `ErroApi { status, code, title, errors, bloqueadoAte }`, 401 → limpa sessão e vai para `/acesso`, 403 `TROCA_SENHA_OBRIGATORIA` → vai para `/trocar-senha`, `baixarArquivo(url)` via Blob, `enviarArquivo(url, File)` via `FormData` campo `arquivo`
- [X] T037 [PORTAL] Criar `portal/src/auth/SessaoProvider.tsx`: guarda `SessaoPortal` em memória + `sessionStorage['jn.portalToken']`, expõe `entrar`, `sair`, `atualizar(sessao)`, `empresa` e `trocaSenhaObrigatoria`; `RotaProtegida` (sem sessão → `/acesso`; troca pendente → `/trocar-senha`)
- [X] T038 [P] [PORTAL] Configurar MSW em `portal/src/mocks/` (`browser.ts`, `server.ts`, `dados.ts` com empresa de exemplo CNPJ `12345678000195`, senha temporária `Temp1234` e nova `Nova1234` conforme `quickstart.md` §5) e ligar em `portal/src/main.tsx` quando `VITE_USE_MOCKS=true`
- [X] T039 [P] [PORTAL] Criar componentes base em `portal/src/components/` com CSS próprio: `Cabecalho` (fundo `--jn-gray-100`, logo, razão social da empresa logada, "Sair"), `Rodape` (logo + "© Jotanunes Construtora"), `Botao` (primário, secundário, pill), `Campo`, `Selo` (situação com texto + cores §3.4), `TituloPagina` (barra 50×6 px), `Alerta` (erro/sucesso com texto), `icons/` (SVG inline)
- [X] T040 [P] [PORTAL] Testes em `portal/src/components/Selo.test.tsx` e `portal/src/components/Cabecalho.test.tsx`: situação sempre com texto; cabeçalho mostra razão social e "Sair" limpa a sessão
- [X] T041 [P] [PORTAL] Criar `portal/src/utils/cnpj.ts` (máscara progressiva ao digitar, normalização, validação de DV numérico/alfanumérico — research R9) e `portal/src/utils/datas.ts`, com testes `cnpj.test.ts` usando os três CNPJs de exemplo
- [X] T042 [PORTAL] Criar `portal/src/App.tsx` com `BrowserRouter` e rotas `/acesso`, `/trocar-senha`, `/documentos`, `/documentos/:tipoDocumentoId` (as duas últimas protegidas por `RotaProtegida`, `/trocar-senha` exige sessão), ligadas a componentes provisórios em `portal/src/pages/` (`Acesso`, `TrocaSenha`, `MeusDocumentos`, `DocumentoHistorico`) que as stories substituem sem editar `App.tsx`; `/` redireciona para `/documentos`, layout com `Cabecalho`/`Rodape` e container de 1140 px

**Checkpoint**: cada área com base pronta; stories podem começar em paralelo nas três áreas.

---

## Phase 3: User Story 1 - Cadastros da Jotanunes (Priority: P1) 🎯 MVP

**Goal**: tipos de documento, obras, empresas e vínculos cadastráveis pela área Jotanunes com
identidade Fluig.

**Independent Test**: com token Fluig, cadastrar 2 tipos, 1 obra, 2 empresas, vincular as duas e ver
"Empresas da obra" com as duas (quickstart passos 1–8).

### Tests for User Story 1 (BACKEND) ⚠️

- [X] T043 [P] [US1] [BACKEND] Testes de domínio em `backend/tests/Jotanunes.Docs.Domain.Tests/CadastrosTests.cs`: `Obra` exige `nome` 3–150, `cidade` 2–100, UF válida, `codigo` ≤ 30; `Empresa` exige `razaoSocial` 2–200, CNPJ válido, e-mail válido, `telefone` 10–11 dígitos quando informado; `TipoDocumento` exige `nome` 3–120 e `instrucoes` ≤ 1000
- [X] T044 [P] [US1] [BACKEND] Testes de integração de obras em `backend/tests/Jotanunes.Docs.Api.Tests/Fluig/ObrasTests.cs`: criar (201 + Location), listar com `busca`/`ativa`/paginação e `quantidadeEmpresas`, obter detalhe, atualizar/desativar, `codigo` duplicado case-insensitive → 409 `CODIGO_OBRA_DUPLICADO`, UF inválida → 400 `VALIDACAO` com `errors.uf`, id inexistente → 404
- [X] T045 [P] [US1] [BACKEND] Testes de integração de empresas em `backend/tests/Jotanunes.Docs.Api.Tests/Fluig/EmpresasTests.cs`: criar com CNPJ mascarado e alfanumérico (saída sem máscara), `situacaoAcesso=NAO_CONVIDADA`, `cnpjEditavel=true`, `documentos.total` = nº de tipos ativos e `pendentes` = total; CNPJ repetido com/sem máscara → 409 `CNPJ_DUPLICADO`; DV inválido → 400 com `errors.cnpj`; listar com `busca` por nome e por CNPJ e filtro `obraId`; atualizar e desativar (`situacaoAcesso=DESATIVADA`)
- [X] T046 [P] [US1] [BACKEND] Testes de integração de vínculos e tipos em `backend/tests/Jotanunes.Docs.Api.Tests/Fluig/VinculosTiposTests.cs`: `PUT` vínculo 204 idempotente (sem duplicar), `DELETE` 204 e 404 se não existe, detalhe da obra lista empresas ordenadas com `ContagemDocumentos`; tipos: criar, `GET /api/fluig/tipos-documento/{id}` (200 e 404), `PUT` alterando nome/instruções, nome duplicado case-insensitive (no POST e no PUT) → 409 `NOME_DUPLICADO`, filtro `ativo`, desativar reduz `documentos.total` das empresas e criar tipo novo aumenta `pendentes` de todas as empresas ativas (FR-015)
- [X] T047 [P] [US1] [BACKEND] Teste de autorização em `backend/tests/Jotanunes.Docs.Api.Tests/Autorizacao/FluigRotasTests.cs`: para CADA endpoint `/api/fluig/*` registrado na API (enumerado via `EndpointDataSource`, então cobre automaticamente as rotas das stories seguintes), sem token → 401 e com token do portal → 401; a cobertura total do contrato é garantida pelo teste de contrato da Fase 8

### Implementation for User Story 1 (BACKEND)

- [X] T048 [P] [US1] [BACKEND] Comportamento de domínio: fábricas e métodos `Atualizar`/`Ativar`/`Desativar` com as validações dos testes em `backend/src/Jotanunes.Docs.Domain/Obras/Obra.cs`, `backend/src/Jotanunes.Docs.Domain/Empresas/Empresa.cs` (dados cadastrais; CNPJ só alterável se nunca convidada) e `backend/src/Jotanunes.Docs.Domain/TiposDocumento/TipoDocumento.cs`
- [X] T049 [US1] [BACKEND] Repositórios EF `ObraRepositorio`, `EmpresaRepositorio`, `TipoDocumentoRepositorio` em `backend/src/Jotanunes.Docs.Infrastructure/Persistencia/Repositorios/`, com tradução de violação de índice único para `CNPJ_DUPLICADO`/`CODIGO_OBRA_DUPLICADO`/`NOME_DUPLICADO`
- [X] T050 [US1] [BACKEND] Implementar `ConsultaDocumentosEf : IConsultaDocumentos` em `backend/src/Jotanunes.Docs.Infrastructure/Persistencia/Consultas/ConsultaDocumentosEf.cs`: situação por empresa × tipo ativo e `ContagemDocumentos` pela regra de `data-model.md` §6 (em lote para listas, sem N+1), e `SituacaoAcesso` derivada (§2) usando o convite mais recente
- [X] T051 [US1] [BACKEND] Casos de uso de obras em `backend/src/Jotanunes.Docs.Application/Obras/` (`CriarObra`, `AtualizarObra`, `ListarObras`, `ObterObra` com `EmpresaNaObra[]`, `VincularEmpresa`, `DesvincularEmpresa`) registrando `criado_por_login`/`vinculado_por_login` de `IUsuarioFluigAtual`
- [X] T052 [US1] [BACKEND] Casos de uso de empresas em `backend/src/Jotanunes.Docs.Application/Empresas/` (`CriarEmpresa`, `AtualizarEmpresa` — `CNPJ_IMUTAVEL` se já convidada —, `ListarEmpresas` com `busca` e `obraId`, `ObterEmpresa` com `obras`, `cnpjEditavel`, `ultimoConvite`, `ultimoAcessoEm`, `documentos`); desativar incrementa `versao_credencial`
- [X] T053 [P] [US1] [BACKEND] Casos de uso de tipos em `backend/src/Jotanunes.Docs.Application/TiposDocumento/` (`CriarTipo`, `AtualizarTipo`, `ListarTipos` ordenado por nome com filtro `ativo`, `ObterTipo`)
- [X] T054 [US1] [BACKEND] Endpoints em `backend/src/Jotanunes.Docs.Api/Endpoints/Fluig/ObrasEndpoints.cs`, `EmpresasEndpoints.cs`, `TiposDocumentoEndpoints.cs` exatamente como `openapi.yaml` (rotas, códigos 200/201/204/400/404/409, `Location`), todos em `MapGroup("/api/fluig").RequireAuthorization("Fluig")`

### Implementation for User Story 1 (FLUIG)

- [X] T055 [P] [US1] [FLUIG] Handlers MSW em `fluig-app/src/mocks/handlers/obras.ts`, `empresas.ts`, `tiposDocumento.ts` cobrindo todas as rotas de obras, vínculos, empresas (GET/POST/PUT) e tipos, incluindo erros `CNPJ_DUPLICADO`, `NOME_DUPLICADO`, `CODIGO_OBRA_DUPLICADO` e `VALIDACAO`
- [X] T056 [P] [US1] [FLUIG] Página `fluig-app/src/pages/TiposDocumento.tsx` (+ `.css`): tabela com nome, instruções resumidas e situação (Ativo/Inativo), filtro ativo/inativo, modal de criar/editar (nome 3–120, instruções ≤ 1000), ativar/desativar com confirmação e aviso "Este tipo deixa de ser exigido das empresas."
- [X] T057 [P] [US1] [FLUIG] Páginas `fluig-app/src/pages/Obras.tsx` (lista com filtros busca/ativa, paginação, quantidade de empresas, criar) e `fluig-app/src/pages/ObraDetalhe.tsx` (dados editáveis, ativar/desativar, tabela de empresas vinculadas com situação de acesso e "X de Y aprovados", vincular empresa por busca, desvincular com confirmação)
- [X] T058 [P] [US1] [FLUIG] Páginas `fluig-app/src/pages/Empresas.tsx` (lista com busca por nome/CNPJ e filtro por obra, paginação, CNPJ mascarado, selo de situação de acesso, criar empresa) e `fluig-app/src/pages/EmpresaDetalhe.tsx` (formulário de edição com CNPJ bloqueado quando `cnpjEditavel=false`, ativar/desativar, obras vinculadas); validação de CNPJ no cliente com `utils/cnpj.ts` e erros do servidor por campo
- [X] T059 [P] [US1] [FLUIG] Testes em `fluig-app/src/pages/TiposDocumento.test.tsx`, `Obras.test.tsx`, `ObraDetalhe.test.tsx`, `Empresas.test.tsx`: criar tipo e ver na lista; nome duplicado mostra "Já existe um tipo de documento com este nome."; criar obra; vincular empresa aparece na tabela; CNPJ inválido mostra erro no campo sem chamar a API; `CNPJ_DUPLICADO` mostra "Já existe uma empresa com este CNPJ."

**Checkpoint**: US1 funcional na API (testes xUnit) e no fluig-app (Vitest + mocks).

---

## Phase 4: User Story 2 - Convite por e-mail e primeiro acesso (Priority: P1)

**Goal**: a analista convida a empresa; a empresa entra com CNPJ + senha temporária e troca a senha.

**Independent Test**: enviar convite, pegar link e senha no e-mail (fake/log), abrir link, entrar,
trocar senha, entrar de novo só com a nova (quickstart passos 9–14, 26–28).

### Tests for User Story 2 (BACKEND) ⚠️

- [X] T060 [P] [US2] [BACKEND] Testes de domínio em `backend/tests/Jotanunes.Docs.Domain.Tests/AcessoEmpresaTests.cs`: `RegistrarConvite` define `troca_senha_obrigatoria=true`, expiração +7 dias e incrementa `versao_credencial`; `TrocarSenha` exige ≥ 8 e ≤ 128 caracteres com letra e número e diferente da atual (`SENHA_FRACA`), zera expiração e incrementa versão; `RegistrarFalhaLogin` bloqueia 15 min na 5ª falha; sucesso zera tentativas; `SituacaoConvite` (VALIDO/USADO/EXPIRADO/SUBSTITUIDO) e `SituacaoAcesso` (5 valores) pela regra de `data-model.md`
- [X] T061 [P] [US2] [BACKEND] Testes de integração de convite em `backend/tests/Jotanunes.Docs.Api.Tests/Fluig/ConvitesTests.cs`: `POST /api/fluig/empresas/{id}/convites` → 201, e-mail fake para `emailContato` contendo link `{Portal:BaseUrl}/acesso?convite=<token>`, razão social, nomes das obras vinculadas e senha temporária de 12 caracteres; resposta sem token/senha; `situacaoAcesso=CONVIDADA`; `cnpjEditavel=false`; reenvio marca o anterior `SUBSTITUIDO`; empresa inativa → 409 `EMPRESA_INATIVA`; falha do e-mail → 502 `EMAIL_FALHOU` sem gravar convite nem alterar a empresa; `GET .../convites` em ordem decrescente; banco guarda só `token_hash` e `senha_hash` BCrypt
- [X] T062 [P] [US2] [BACKEND] Testes de integração de acesso em `backend/tests/Jotanunes.Docs.Api.Tests/Portal/AcessoTests.cs`: `POST /api/portal/convites/validar` (token no corpo) válido → CNPJ + razão social; adulterado, expirado (FakeTimeProvider +7 dias), usado e substituído → 404 `CONVITE_INVALIDO`; login com senha temporária → 200 com `trocaSenhaObrigatoria=true`; senha errada e CNPJ inexistente → 401 `CREDENCIAIS_INVALIDAS` com o mesmo `title`; senha temporária vencida → 401 `CONVITE_EXPIRADO`; 5 falhas → 6ª tentativa 423 `ACESSO_BLOQUEADO` com `bloqueadoAte`; empresa desativada com senha certa → 403 `EMPRESA_INATIVA`; 11ª requisição/min do mesmo IP → 429 `LIMITE_REQUISICOES`
- [X] T063 [P] [US2] [BACKEND] Testes de troca de senha e sessão em `backend/tests/Jotanunes.Docs.Api.Tests/Portal/TrocaSenhaTests.cs`: com troca pendente `GET /api/portal/me` 200 e rotas de `PortalCompleto` 403 `TROCA_SENHA_OBRIGATORIA`; senha fraca → 400 `SENHA_FRACA`; atual errada → 400 `SENHA_ATUAL_INCORRETA`; sucesso devolve novo token com `trocaSenhaObrigatoria=false`, marca convite `USADO`, e o token antigo passa a 401; login com senha temporária depois da troca → 401; reenvio de convite derruba sessão ativa (401); desativar empresa derruba sessão (401); token Fluig em `/api/portal/me` → 401

### Implementation for User Story 2 (BACKEND)

- [X] T064 [P] [US2] [BACKEND] Comportamento de domínio em `backend/src/Jotanunes.Docs.Domain/Empresas/Empresa.cs`, `backend/src/Jotanunes.Docs.Domain/Empresas/PoliticaSenha.cs` e `backend/src/Jotanunes.Docs.Domain/Convites/Convite.cs` conforme os testes de domínio da US2
- [X] T065 [P] [US2] [BACKEND] Adaptadores de segurança em `backend/src/Jotanunes.Docs.Infrastructure/Seguranca/`: `BCryptHasherSenha` (work factor 12, verificação dummy para CNPJ inexistente), `GeradorSegredos` (token 32 bytes base64url + SHA-256 hex; senha temporária de 12 caracteres do alfabeto sem ambíguos da research R3, com letra e número) e `EmissorTokenPortal` (JWT HS256 8 h com `sub`, `cnpj`, `ver`, `troca_senha`)
- [X] T066 [P] [US2] [BACKEND] Adaptadores de e-mail em `backend/src/Jotanunes.Docs.Infrastructure/Email/`: `ResendEnviadorEmail` (`HttpClient` tipado, `POST https://api.resend.com/emails`, Bearer `Resend:ApiKey`, `from` = `Resend:From`, timeout 10 s, não-2xx → `FalhaEnvioEmail`) e `LogEnviadorEmail` (usado quando `Resend:ApiKey` vazio, só em Development); seleção no DI
- [X] T067 [US2] [BACKEND] `ModelosEmail.Convite(...)` em `backend/src/Jotanunes.Docs.Application/Emails/ModelosEmail.cs`: assunto "Jotanunes: envie os documentos da sua empresa", HTML simples com cores da marca + versão texto, com "A Jotanunes precisa dos documentos da sua empresa para a obra {obra}. É só clicar no botão abaixo.", link, CNPJ, senha temporária e validade
- [X] T068 [US2] [BACKEND] Casos de uso em `backend/src/Jotanunes.Docs.Application/Convites/` (`EnviarConvite` com ordem gravar → enviar e-mail → commit e rollback em falha, `ListarConvites`) e `backend/src/Jotanunes.Docs.Application/Portal/` (`ValidarConvite`, `LoginPortal`, `TrocarSenha`, `ObterEmpresaPortal`), com auditoria `CONVITE_ENVIADO`, `LOGIN_SUCESSO`, `LOGIN_FALHA`, `LOGIN_BLOQUEADO`, `SENHA_TROCADA`
- [X] T069 [US2] [BACKEND] Endpoints em `backend/src/Jotanunes.Docs.Api/Endpoints/Fluig/ConvitesEndpoints.cs` e `backend/src/Jotanunes.Docs.Api/Endpoints/Portal/AcessoEndpoints.cs` conforme `openapi.yaml`; rate limiter de janela fixa 10/min por IP nas rotas anônimas (429 com `Retry-After`); `OnTokenValidated` do esquema `Portal` conferindo `ver` e `ativa` no banco; `ultimoConvite` preenchido em `GET /api/fluig/empresas/{id}`

### Implementation for User Story 2 (FLUIG)

- [X] T070 [P] [US2] [FLUIG] Handlers MSW em `fluig-app/src/mocks/handlers/convites.ts` (POST/GET convites, incluindo `EMPRESA_INATIVA` e `EMAIL_FALHOU`)
- [X] T071 [US2] [FLUIG] Em `fluig-app/src/pages/EmpresaDetalhe.tsx`: seção "Acesso ao portal" com selo da situação de acesso, último convite (enviado em, por, expira em, situação), botão "Enviar convite" (ou "Reenviar convite" com modal "A senha e o link anteriores deixam de valer. Continuar?"), mensagens de sucesso e de `EMAIL_FALHOU`, histórico de convites; botão desabilitado se empresa inativa
- [X] T072 [P] [US2] [FLUIG] Testes em `fluig-app/src/pages/EmpresaDetalhe.convite.test.tsx`: enviar convite muda selo para "Convidada"; reenviar pede confirmação; `EMAIL_FALHOU` mostra "Não conseguimos enviar o convite. Tente de novo em alguns minutos." e mantém a situação

### Implementation for User Story 2 (PORTAL)

- [X] T073 [P] [US2] [PORTAL] Handlers MSW em `portal/src/mocks/handlers/acesso.ts` para `POST /api/portal/convites/validar`, `POST /api/portal/auth/login`, `POST /api/portal/auth/trocar-senha`, `GET /api/portal/me`, com cenários `CREDENCIAIS_INVALIDAS`, `CONVITE_EXPIRADO`, `ACESSO_BLOQUEADO`, `EMPRESA_INATIVA`, `CONVITE_INVALIDO`, `SENHA_FRACA`, `SENHA_ATUAL_INCORRETA`
- [X] T074 [US2] [PORTAL] Página `portal/src/pages/Acesso.tsx` (+ `.css`): painel com `--jn-radius-signature`, título "Acesse o portal de documentos", campos "CNPJ" (máscara) e "Senha", botão pill "Acessar"; com `?convite=` chama a validação e pré-preenche o CNPJ, ou mostra "Este link não é mais válido."; mensagens por `code` (bloqueio mostra o horário de `bloqueadoAte`); após login vai para `/trocar-senha` ou `/documentos`
- [X] T075 [US2] [PORTAL] Página `portal/src/pages/TrocaSenha.tsx` (+ `.css`): "Crie uma nova senha para continuar.", campos senha atual (a do convite), nova e confirmação, regras visíveis (≥ 8, letra e número), validação no cliente, erros `SENHA_FRACA`/`SENHA_ATUAL_INCORRETA`; sucesso atualiza a sessão com o novo token e vai para `/documentos`
- [X] T076 [P] [US2] [PORTAL] Testes em `portal/src/pages/Acesso.test.tsx` e `portal/src/pages/TrocaSenha.test.tsx`: link de convite pré-preenche CNPJ; link inválido mostra a mensagem; credenciais erradas mostram "CNPJ ou senha incorretos."; convite expirado e bloqueio mostram suas mensagens; login com troca pendente leva à troca e impede abrir `/documentos`; senha fraca é recusada no cliente; troca bem-sucedida leva a `/documentos`

**Checkpoint**: US1 + US2 funcionando; empresa consegue entrar no portal.

---

## Phase 5: User Story 3 - Empresa envia documentos e acompanha a situação (Priority: P1)

**Goal**: a empresa vê os documentos exigidos, envia arquivos e acompanha a situação.

**Independent Test**: empresa ativa com 3 tipos ativos vê 3 "Pendente de envio", envia um PDF e vê
"Em análise" (quickstart passos 15–20).

### Tests for User Story 3 (BACKEND) ⚠️

- [X] T077 [P] [US3] [BACKEND] Testes unitários em `backend/tests/Jotanunes.Docs.Application.Tests/Envios/DetectorFormatoTests.cs` e `SituacaoDocumentoTests.cs`: assinatura `%PDF-`, PNG `89 50 4E 47 0D 0A 1A 0A` e JPEG `FF D8 FF` reconhecidas; `.exe` (MZ) e texto recusados; 0 byte → inválido; derivação da situação (`PENDENTE_ENVIO` sem envio, envio vivo define situação, só rejeitados → `REJEITADO` com motivo do mais recente) e `podeEnviar`
- [X] T078 [P] [US3] [BACKEND] Testes de integração em `backend/tests/Jotanunes.Docs.Api.Tests/Portal/DocumentosTests.cs`: `GET /api/portal/documentos` lista todos os tipos ativos na ordem do contrato; `POST .../envios` com PDF → 201 `EM_ANALISE` com `formato` detectado e `tamanhoBytes`; novo envio com documento em análise → 409 `ENVIO_NAO_PERMITIDO`; 10.485.761 bytes → 413 `ARQUIVO_MUITO_GRANDE`; `.exe` renomeado `.pdf` → 415 `ARQUIVO_TIPO_NAO_SUPORTADO`; vazio → 400 `ARQUIVO_INVALIDO`; tipo inativo ou inexistente → 404; dois envios simultâneos para o mesmo tipo → um 201 e um 409; histórico em ordem decrescente; download do próprio arquivo com `Content-Disposition` attachment, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` e bytes idênticos; arquivo gravado sob `Storage:Root` com chave sem o nome original
- [X] T079 [P] [US3] [BACKEND] Testes de isolamento em `backend/tests/Jotanunes.Docs.Api.Tests/Autorizacao/IsolamentoEmpresasTests.cs`: com token da empresa B, download de envio da empresa A → 404; histórico de B nunca contém envios de A; `GET /api/portal/documentos` de B não reflete envios de A; para CADA endpoint `/api/portal/*` autenticado registrado na API (via `EndpointDataSource`), sem token → 401 e com token Fluig → 401; `EnvioPortal` serializado não contém `analisadoPor`

### Implementation for User Story 3 (BACKEND)

- [X] T080 [P] [US3] [BACKEND] Adaptadores em `backend/src/Jotanunes.Docs.Infrastructure/Armazenamento/`: `ArmazenamentoDiscoLocal : IArmazenamentoArquivos` (raiz `Storage:Root`, chave `empresas/{empresaId:N}/{envioId:N}`, bloqueio de path traversal) e `DetectorFormato` (assinaturas da research R6)
- [X] T081 [US3] [BACKEND] Caso de uso `EnviarDocumento` em `backend/src/Jotanunes.Docs.Application/Envios/EnviarDocumento.cs`: `empresaId` só de `IEmpresaPortalAtual`; tipo ativo; tamanho 1–10.485.760; formato detectado; SHA-256; nome saneado ≤ 255; grava arquivo → grava registro `EM_ANALISE` → em violação do índice parcial devolve `ENVIO_NAO_PERMITIDO` e exclui o arquivo; auditoria `DOCUMENTO_ENVIADO`
- [X] T082 [P] [US3] [BACKEND] Casos de uso `ListarDocumentosPortal`, `ListarHistoricoPortal` e `BaixarArquivoPortal` (auditoria `ARQUIVO_BAIXADO`; envio de outra empresa → `NAO_ENCONTRADO`) em `backend/src/Jotanunes.Docs.Application/Portal/`
- [X] T083 [US3] [BACKEND] Endpoints em `backend/src/Jotanunes.Docs.Api/Endpoints/Portal/DocumentosEndpoints.cs` com política `PortalCompleto`, `RequestSizeLimit` de 11 MB e `MultipartBodyLengthLimit`, mapeamento de limite excedido para 413 `ARQUIVO_MUITO_GRANDE`, e resposta de arquivo com os headers do contrato

### Implementation for User Story 3 (PORTAL)

- [X] T084 [P] [US3] [PORTAL] Handlers MSW em `portal/src/mocks/handlers/documentos.ts` para listar documentos, histórico, envio (transição para `EM_ANALISE`; erros 409/413/415/400) e download
- [X] T085 [P] [US3] [PORTAL] Componente `portal/src/components/EnvioArquivo.tsx` (+ `.css`): botão "Enviar documento" com `<input type="file" accept="application/pdf,image/jpeg,image/png">`, validação no cliente (PDF/JPG/PNG, ≤ 10 MB, não vazio) com as mensagens do contrato, estado de envio ("Enviando…") e erros do servidor por `code`; se a sessão expirar durante o envio (401), volta ao login com o aviso "Sua sessão expirou. Entre de novo e envie o arquivo outra vez."
- [X] T086 [US3] [PORTAL] Página `portal/src/pages/MeusDocumentos.tsx` (+ `.css`): título com barra vermelha, cards por documento (nome, instruções, `Selo` da situação, arquivo atual com data em `America/Sao_Paulo`, link para baixar, `EnvioArquivo` só quando `podeEnviar`), estado vazio "Nenhum documento pendente. Tudo certo por aqui." quando não há pendente/rejeitado, grade responsiva (1 coluna em 360 px)
- [X] T087 [P] [US3] [PORTAL] Página `portal/src/pages/DocumentoHistorico.tsx`: lista de envios do tipo (mais recente primeiro) com situação, datas, motivo de rejeição e download; nunca exibe quem analisou
- [X] T088 [P] [US3] [PORTAL] Testes em `portal/src/pages/MeusDocumentos.test.tsx` e `portal/src/components/EnvioArquivo.test.tsx`: 3 documentos "Pendente de envio"; enviar PDF muda para "Em análise" e some o botão; arquivo `.exe` e arquivo > 10 MB recusados no cliente com a mensagem certa; `ENVIO_NAO_PERMITIDO` do servidor exibido; estado vazio exibido; download chama a URL do envio com Bearer

**Checkpoint**: MVP (US1 + US2 + US3) completo e testável ponta a ponta.

---

## Phase 6: User Story 4 - Análise dos documentos e reenvio dos rejeitados (Priority: P2)

**Goal**: a analista aprova/rejeita com motivo; a empresa vê o motivo e reenvia.

**Independent Test**: rejeitar com motivo, empresa vê motivo e reenvia, analista aprova, histórico
mostra os dois envios com analista, data e motivo (quickstart passos 21–25).

### Tests for User Story 4 (BACKEND) ⚠️

- [X] T089 [P] [US4] [BACKEND] Testes de domínio em `backend/tests/Jotanunes.Docs.Domain.Tests/EnvioDocumentoTests.cs`: `Aprovar` e `Rejeitar` só a partir de `EM_ANALISE`; motivo com trim, 5–500 caracteres; registram `analisado_por_login`, `analisado_por_nome`, `analisado_em`; `APROVADO`/`REJEITADO` imutáveis
- [X] T090 [P] [US4] [BACKEND] Testes de integração em `backend/tests/Jotanunes.Docs.Api.Tests/Fluig/AnaliseTests.cs`: fila padrão `EM_ANALISE` do mais antigo ao mais novo com filtros `obraId`, `empresaId`, `tipoDocumentoId` e paginação; `APROVADO`/`REJEITADO` em ordem decrescente; `GET /api/fluig/envios/{id}` com empresa e tipo; download Fluig com headers do contrato; aprovar → 200 com `analisadoPor` = login/nome do token; rejeitar sem motivo ou com 4 caracteres → 400 `VALIDACAO`; rejeitar com motivo → 200 e e-mail fake para a empresa com tipo, motivo e link do portal; falha do e-mail de rejeição não desfaz a decisão; duas aprovações simultâneas → uma 200 e uma 409 `ENVIO_JA_ANALISADO`; após rejeição a empresa consegue novo envio (201); envio `EM_ANALISE` de tipo desativado depois do envio ainda pode ser aprovado; `GET /api/fluig/empresas/{id}/documentos` e histórico por tipo (inclui tipo inativo)

### Implementation for User Story 4 (BACKEND)

- [X] T091 [P] [US4] [BACKEND] Métodos `Aprovar`/`Rejeitar` em `backend/src/Jotanunes.Docs.Domain/Envios/EnvioDocumento.cs`
- [X] T092 [US4] [BACKEND] Casos de uso em `backend/src/Jotanunes.Docs.Application/Envios/`: `ListarFilaEnvios`, `ObterEnvio`, `BaixarArquivoFluig` (auditoria `ARQUIVO_BAIXADO`), `AprovarEnvio` e `RejeitarEnvio` com atualização condicional (`ExecuteUpdateAsync ... WHERE status = 'EM_ANALISE'`; 0 linhas → `ENVIO_JA_ANALISADO`), auditoria `ENVIO_APROVADO`/`ENVIO_REJEITADO`, e-mail `ModelosEmail.Rejeicao` (falha só gera log de aviso), `ListarDocumentosEmpresa`, `ListarHistoricoEnviosEmpresa`
- [X] T093 [US4] [BACKEND] Endpoints em `backend/src/Jotanunes.Docs.Api/Endpoints/Fluig/AnaliseEndpoints.cs` (`/api/fluig/envios*`, `/api/fluig/empresas/{id}/documentos*`) conforme `openapi.yaml`

### Implementation for User Story 4 (FLUIG)

- [X] T094 [P] [US4] [FLUIG] Handlers MSW em `fluig-app/src/mocks/handlers/analise.ts` (fila com filtros, detalhe, arquivo, aprovar, rejeitar com `VALIDACAO` e `ENVIO_JA_ANALISADO`, documentos e histórico da empresa)
- [X] T095 [P] [US4] [FLUIG] Página `fluig-app/src/pages/FilaAnalise.tsx` (+ `.css`): filtros obra/empresa/tipo no padrão de filtros, tabela (empresa, CNPJ mascarado, documento, enviado em, "Analisar →"), paginação, estado vazio "Nenhum documento aguardando análise."
- [X] T096 [US4] [FLUIG] Página `fluig-app/src/pages/EnvioAnalise.tsx` (+ `.css`): dados do envio, "Abrir arquivo" (Blob em nova aba), botões "Aprovar" e "Rejeitar" (modal com motivo obrigatório 5–500 e contador), tratamento de `ENVIO_JA_ANALISADO` ("Este envio já foi analisado.") recarregando o envio, retorno à fila após decidir
- [X] T097 [US4] [FLUIG] Em `fluig-app/src/pages/EmpresaDetalhe.tsx`: seção "Documentos" com situação por tipo (`Selo`) e modal de histórico por tipo mostrando status, analista, data e motivo
- [X] T098 [P] [US4] [FLUIG] Testes em `fluig-app/src/pages/FilaAnalise.test.tsx` e `fluig-app/src/pages/EnvioAnalise.test.tsx`: fila exibe mais antigo primeiro e aplica filtro; aprovar mostra "Aprovado"; rejeitar sem motivo é bloqueado; rejeitar com motivo mostra "Rejeitado"; `ENVIO_JA_ANALISADO` exibe a mensagem

### Implementation for User Story 4 (PORTAL)

- [X] T099 [US4] [PORTAL] Em `portal/src/pages/MeusDocumentos.tsx`: documento `REJEITADO` destacado primeiro, com motivo em destaque ("Motivo: …") e botão "Enviar novo arquivo"; ao reenviar volta a "Em análise"
- [X] T100 [P] [US4] [PORTAL] Testes em `portal/src/pages/MeusDocumentos.rejeicao.test.tsx`: rejeitado mostra motivo e "Enviar novo arquivo"; reenvio muda para "Em análise"; histórico mostra o envio rejeitado com motivo e sem nome de analista

**Checkpoint**: ciclo completo envio → análise → reenvio.

---

## Phase 7: User Story 5 - Acompanhamento por obra e por empresa (Priority: P3)

**Goal**: painel com indicadores e filtros de acompanhamento.

**Independent Test**: com dados de exemplo, painel e detalhe da obra batem com contagem manual
(quickstart passo 30).

### Tests for User Story 5 (BACKEND) ⚠️

- [X] T101 [P] [US5] [BACKEND] Testes em `backend/tests/Jotanunes.Docs.Api.Tests/Fluig/PainelTests.cs`: `GET /api/fluig/painel` com cenário semeado confere `enviosEmAnalise`, `empresasComPendencia` (ativas com pendente ou rejeitado), `empresasConvidadasSemAcesso` (`CONVIDADA` + `CONVITE_EXPIRADO`), `empresasAtivas`, `obrasAtivas`; `GET /api/fluig/empresas` com `situacaoAcesso` e `comPendencia=true`

### Implementation for User Story 5 (BACKEND)

- [X] T102 [US5] [BACKEND] Caso de uso `ObterPainel` em `backend/src/Jotanunes.Docs.Application/Painel/ObterPainel.cs` (consultas agregadas em `ConsultaDocumentosEf`), filtros `situacaoAcesso` e `comPendencia` em `ListarEmpresas`, e endpoint `GET /api/fluig/painel` em `backend/src/Jotanunes.Docs.Api/Endpoints/Fluig/SessaoEndpoints.cs`

### Implementation for User Story 5 (FLUIG)

- [X] T103 [US5] [FLUIG] Página `fluig-app/src/pages/Painel.tsx` (+ `.css`): cards de indicador (fundo branco, borda `--jn-border-card`, raio 20 px, ícone de linha, número grande + texto), cada card levando à lista filtrada (fila de análise; empresas com `comPendencia=true`; empresas com `situacaoAcesso=CONVIDADA`)
- [X] T104 [US5] [FLUIG] Em `fluig-app/src/pages/Empresas.tsx`: filtros "Situação de acesso" e "Com pendência" lidos/escritos na query string; atualizar handler `fluig-app/src/mocks/handlers/empresas.ts` para os filtros
- [X] T105 [P] [US5] [FLUIG] Testes em `fluig-app/src/pages/Painel.test.tsx`: indicadores exibidos com os números do mock; clique em "empresas com pendência" abre a lista filtrada

**Checkpoint**: todas as user stories funcionais.

---

## Phase 8: Polish & Cross-Cutting Concerns

### BACKEND

- [X] T106 [P] [BACKEND] Teste de contrato em `backend/tests/Jotanunes.Docs.Api.Tests/Contrato/ContratoOpenApiTests.cs`: lê `../specs/001-portal-documentos-terceirizadas/contracts/openapi.yaml` (caminho relativo à raiz do repositório) e verifica que cada par rota+método do contrato existe na API (`EndpointDataSource`) e vice-versa (exceto rotas internas), e que todo `code` de `CodigoErro` existe no enum C#
- [X] T107 [P] [BACKEND] Teste de desempenho em `backend/tests/Jotanunes.Docs.Api.Tests/Desempenho/ListasTests.cs` (categoria `Desempenho`): semeia 50 obras, 500 empresas, 30 tipos e 20.000 envios e verifica `GET /api/fluig/empresas`, `GET /api/fluig/envios` e `GET /api/portal/documentos` abaixo de 2 s (SC-006); ajustar índices/consultas se falhar
- [X] T108 [P] [BACKEND] Endurecimento em `backend/src/Jotanunes.Docs.Api/Program.cs`: headers `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY` na API; logs estruturados sem senha/token/corpo de arquivo (revisar todos os `ILogger` e o `LogEnviadorEmail`); teste em `backend/tests/Jotanunes.Docs.Api.Tests/Seguranca/LogsTests.cs` garantindo que login e troca de senha não escrevem a senha no log
- [X] T109 [BACKEND] `backend/src/Jotanunes.Docs.Api/Properties/launchSettings.json` (porta 5080, `ASPNETCORE_ENVIRONMENT=Development`, connection string do compose, `Portal__BaseUrl=http://localhost:5174`, `Storage__Root=../../.data/uploads` (resolve para `backend/.data/uploads`, pois a raiz de conteúdo é `backend/src/Jotanunes.Docs.Api`), `Cors__Origins`, sem segredos) e `backend/README.md` com comandos de build, testes, migrations e variáveis

### FLUIG

- [X] T110 [P] [FLUIG] Script `fluig-app/scripts/verificar-sem-framework-css.mjs` (+ `npm run check:css` no `package.json`) que falha se `package.json` tiver `tailwindcss`, `bootstrap`, `@mui/*`, `@chakra-ui/*`, `antd`, `styled-components`, `@emotion/*` ou similares
- [X] T111 [P] [FLUIG] Revisão de acessibilidade e responsividade em `fluig-app/src/`: rótulos em todos os campos, foco visível, contraste AA (sem `#AFB0B1`/`#7A7A7A` em texto), tabelas com rolagem interna em 360 px, estilos 100% escopados em `.jn-app`
- [X] T112 [FLUIG] `fluig-app/README.md`: como rodar com mocks, com API real, com token de dev e como o Fluig abre o app (`#fluigToken=`)

### PORTAL

- [X] T113 [P] [PORTAL] Script `portal/scripts/verificar-sem-framework-css.mjs` (+ `npm run check:css`) com a mesma lista de bibliotecas proibidas
- [X] T114 [P] [PORTAL] Revisão de acessibilidade e responsividade em `portal/src/`: rótulos, foco visível, contraste AA, sem rolagem horizontal em 360 px, mensagens de erro associadas aos campos
- [X] T115 [PORTAL] `portal/README.md`: como rodar com mocks e com API real, credenciais de mock

### INFRA

- [X] T116 [INFRA] Executar o roteiro E2E de `specs/001-portal-documentos-terceirizadas/quickstart.md` §6 com as três áreas integradas (`VITE_USE_MOCKS=false`) e registrar divergências de contrato para correção na área responsável

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende do Setup **da mesma área**; bloqueia as stories daquela área.
- **User Stories (Phase 3–7)**: dependem da Fase 2 da área. Em cada área, seguir P1 → P2 → P3.
- **Polish (Phase 8)**: depois das stories desejadas; a tarefa E2E [INFRA] exige as três áreas.

### User Story Dependencies

- **US1 (P1)**: nenhuma.
- **US2 (P1)**: usa a empresa cadastrada (US1) — no backend os testes semeiam empresas direto no
  banco, então pode ser feita em paralelo; no fluig-app estende `EmpresaDetalhe.tsx` (fazer depois da
  tarefa de páginas de empresa da US1).
- **US3 (P1)**: precisa de sessão do portal (US2) na UI; no backend os testes geram token de portal
  direto e semeiam tipos, sendo independentes.
- **US4 (P2)**: precisa de envios (US3); testes semeiam envios.
- **US5 (P3)**: usa consultas de contagem da US1.

### Dependências entre áreas

- Nenhuma dependência de arquivo entre áreas. A única dependência é **semântica** via contrato
  `openapi.yaml` (somente leitura para todos).
- `[INFRA]` Fase 1 (compose/.env/script) é necessária apenas para rodar localmente, não para os
  testes automatizados de nenhuma área.

### Within Each User Story

- Testes primeiro (devem falhar) → domínio → casos de uso → endpoints (backend).
- Handlers MSW → componentes/páginas → testes (fronts; os testes podem ser escritos antes das
  páginas, a partir dos handlers).

### Parallel Opportunities

- As três áreas rodam totalmente em paralelo desde a Fase 1.
- Dentro de cada área, tarefas `[P]` da mesma fase podem ir juntas.

---

## Parallel Example: User Story 1

```bash
# Agente BACKEND — testes da US1 juntos:
Task: "Testes de integração de obras em backend/tests/Jotanunes.Docs.Api.Tests/Fluig/ObrasTests.cs"
Task: "Testes de integração de empresas em backend/tests/Jotanunes.Docs.Api.Tests/Fluig/EmpresasTests.cs"
Task: "Testes de integração de vínculos e tipos em backend/tests/Jotanunes.Docs.Api.Tests/Fluig/VinculosTiposTests.cs"

# Agente FLUIG — ao mesmo tempo, só com o contrato e MSW:
Task: "Handlers MSW em fluig-app/src/mocks/handlers/obras.ts, empresas.ts, tiposDocumento.ts"
Task: "Página fluig-app/src/pages/TiposDocumento.tsx"
Task: "Páginas fluig-app/src/pages/Obras.tsx e ObraDetalhe.tsx"

# Agente PORTAL — adianta a Fase 2 e a US2 (US1 não tem tela no portal)
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3)

1. Fase 1 e 2 em cada área.
2. US1 → US2 → US3 em cada área (o portal começa pela US2).
3. **PARAR E VALIDAR**: quickstart passos 1–20.

### Incremental Delivery

1. MVP (US1–US3) → demo para a Jotanunes (validar decisões assumidas com o Gustavo).
2. US4 (análise) → demo.
3. US5 (painel) → demo.

### Parallel Team Strategy (3 agentes)

- **Agente BACKEND**: só `backend/`, na ordem das fases.
- **Agente FLUIG**: só `fluig-app/`, com MSW.
- **Agente PORTAL**: só `portal/`, com MSW.
- **Orquestrador**: tarefas `[INFRA]` (início e E2E final) e resolução de divergências de contrato.

---

## Notes

- `[P]` = arquivos diferentes, sem dependência de tarefa incompleta.
- Toda tarefa tem exatamente uma área; nenhuma edita fora da própria pasta.
- Commits por tarefa ou grupo lógico (feitos pelo orquestrador).
- Decisões assumidas da spec (Clarifications) podem mudar após validação com o Gustavo; o impacto
  fica concentrado em `EnviarConvite`/`TrocaSenha` (fluxo de senha) e em `ConsultaDocumentosEf`
  (documentos por empresa). Atualização 2026-09-29: senha provisória e "todos os tipos para todas
  as empresas" foram **validadas**; "documentos por empresa, não por obra" continua a validar.

---

## Phase 9: Convergence

**Purpose**: lacunas encontradas pelo `/speckit-converge` (2026-09-29) entre spec/plan/contrato e o código
atual. Cada tarefa cita o requisito e a evidência; ordem: HIGH → MEDIUM → LOW.

- [X] T117 [BACKEND] Aplicar o bloqueio de 5 falhas / 15 min **por CNPJ informado**, e não só por empresa convidada: hoje CNPJ inexistente ou empresa nunca convidada (`SenhaHash` nulo) sempre recebe `401 CREDENCIAIS_INVALIDAS` sem contar falha (`backend/src/Jotanunes.Docs.Application/Portal/CasosDeUsoAcesso.cs:47-53`), enquanto CNPJ convidado passa a `423 ACESSO_BLOQUEADO` na 6ª tentativa (`:55-60`, `Empresa.RegistrarFalhaLogin`), o que revela se o CNPJ existe. Guardar tentativas/bloqueio por CNPJ normalizado (porta + adaptador EF, nova migration) usado pelo `LoginPortal` para qualquer CNPJ, mantendo o comportamento atual para empresas existentes; teste em `backend/tests/Jotanunes.Docs.Api.Tests/Portal/AcessoTests.cs`: 6 tentativas com CNPJ válido inexistente e com empresa não convidada → mesma sequência 401×5 e 423 com `bloqueadoAte` que um CNPJ existente, per FR-062, FR-006 (contrato `portalLogin`: "5 falhas seguidas no mesmo CNPJ") (partial)
- [X] T118 [BACKEND] Recusar arquivo corrompido com `400 ARQUIVO_INVALIDO`: `DetectorFormato` só confere os bytes iniciais (`backend/src/Jotanunes.Docs.Infrastructure/Armazenamento/Armazenamento.cs:70-76`) e `EnviarDocumento` só devolve `ARQUIVO_INVALIDO` para 0 byte (`backend/src/Jotanunes.Docs.Application/Envios/CasosDeUsoEnvioPortal.cs:39`), então um PDF/PNG/JPEG truncado com cabeçalho válido é aceito. Acrescentar checagem estrutural mínima (PDF com `%%EOF` no final, PNG terminando no chunk `IEND`, JPEG terminando em `FF D9`) e mapear falha para `ARQUIVO_INVALIDO` (assinatura desconhecida continua `415`); testes em `backend/tests/Jotanunes.Docs.Application.Tests/Envios/DetectorFormatoTests.cs` e `backend/tests/Jotanunes.Docs.Api.Tests/Portal/DocumentosTests.cs`, per Edge Case "arquivo … corrompido: recusado", FR-033, contrato `portalEnviarDocumento` 400 "vazio/corrompido" (partial)
- [X] T119 [BACKEND] Completar a trilha de auditoria do login: recusas com senha certa por empresa desativada (`CasosDeUsoAcesso.cs:71`, `EMPRESA_INATIVA`) e por senha temporária vencida (`CasosDeUsoAcesso.cs:72`, `CONVITE_EXPIRADO`) lançam erro sem gravar `LOGIN_FALHA`; registrar e salvar antes de lançar. Acrescentar testes que conferem as linhas de `auditoria` (ator, ação, recurso, sem segredos) para `LOGIN_FALHA` nesses dois casos, `LOGIN_BLOQUEADO`, `SENHA_TROCADA` e `ENVIO_REJEITADO` (hoje nenhum teste em `backend/tests/` verifica essas três ações), em `Portal/AcessoTests.cs`, `Portal/TrocaSenhaTests.cs` e `Fluig/AnaliseTests.cs`, per FR-061, Constitution IV (partial)
- [X] T120 [FLUIG] Tornar acessível, no detalhe da empresa, o histórico de envios de tipos de documento desativados: a seção "Documentos" lista só tipos ativos (`fluig-app/src/pages/empresa/SecaoDocumentos.tsx:19` usa `GET /api/fluig/empresas/{id}/documentos`, que no backend filtra `tipos.ListarAsync(true)` em `CasosDeUsoAnalise.cs:109`), então envios de tipo desativado só aparecem pela fila com filtro de status. Acrescentar bloco "Tipos desativados" (tipos de `GET /api/fluig/tipos-documento?ativo=false`) com botão "Histórico" que abre o `ModalHistorico` existente (`GET /api/fluig/empresas/{id}/documentos/{tipoId}/envios` já inclui tipos inativos, contrato linha 375); atualizar handler MSW e cobrir em teste, per US1/AC7, Edge Case "tipo desativado depois de um envio … continua no histórico", FR-046 (partial)
- [X] T121 [FLUIG] Criar testes Vitest para fluxos principais ainda sem cobertura: `fluig-app/src/pages/EmpresaDetalhe.test.tsx` (editar dados e salvar; campo CNPJ bloqueado quando `cnpjEditavel=false`; `CNPJ_IMUTAVEL` do servidor exibido; desativar/ativar com confirmação muda o selo para "Desativada"), `fluig-app/src/pages/EmpresaDetalhe.documentos.test.tsx` (seção "Documentos" com situação em texto; modal de histórico do mais recente ao mais antigo mostrando analista, data e motivo) e em `fluig-app/src/pages/Empresas.test.tsx` os filtros por obra e por situação de acesso (hoje só a busca é testada), per Constitution IV, FR-012, US4/AC8, SC-005, US5/AC3 (partial)
- [X] T122 [BACKEND] Configurar logs estruturados em JSON no console fora de Development (`builder.Logging.AddJsonConsole()` ou `Logging:Console:FormatterName=json` em `appsettings.json`), mantendo o formato simples em Development: hoje `backend/src/Jotanunes.Docs.Api/Program.cs` e `appsettings.json` não definem formatador, per plan: research R12 "Logs estruturados (`ILogger`, console JSON em produção)" (missing)

---

## Phase 10: Perfil administrador e catálogo padrão (US6 P1, US7 P2)

**Purpose**: decisões do dono do produto de 2026-09-29 (spec "Session 2026-09-29"): perfis
administrador/comum vindos do Fluig (US6, FR-080–FR-086, SC-009) e catálogo padrão de 10 tipos de
documento numa instalação nova (US7, FR-090–FR-093, SC-010). Desenho em research R15/R16, plan
"Autenticação" e "Catálogo padrão", data-model §4.1, §7 e §9. Contrato **1.1.0** já atualizado
(`x-requer-admin`, `SemPermissao`, `SEM_PERMISSAO`, `UsuarioFluig.admin`) e `fluig-identity.md`
(claim `roles`): nenhum agente edita o contrato.

**Agentes**: **BACKEND+INFRA** (`backend/`, `scripts/`, `README.md`) e **FLUIG** (`fluig-app/`) em
paralelo; nenhuma tarefa de um exige editar arquivos do outro. `[PORTAL]` T144 é independente e
pequena (orquestrador). `[INFRA]` T145 (E2E) roda por último.

**Independent Test**: quickstart §6 passos 2–3 e 31–38.

### Tests for User Story 6 (BACKEND) ⚠️

- [X] T123 [US6] [BACKEND] Estender `backend/tests/Jotanunes.Docs.Api.Tests/Infra/Tokens.cs`: `Tokens.Fluig(...)` ganha `object? roles` com padrão `new[] { "admin" }` (os testes de escrita existentes continuam como administrador, sem editar cada um) e aceita valores brutos para a claim (`"admin"` texto, `new[] { "Admin" }`, `true`, `1`, objeto) ou `null` para omitir; criar `Tokens.FluigComum(api, login = "joao.comum", nome = "João Comum")` sem `roles`. Rodar a suíte inteira: nenhum teste existente muda de resultado; per FR-080 (base dos testes de perfil)
- [X] T124 [P] [US6] [BACKEND] Testes do perfil pela claim em `backend/tests/Jotanunes.Docs.Api.Tests/Autorizacao/PerfilClaimTests.cs` (regras de `contracts/fluig-identity.md`): `GET /api/fluig/me` → 200 com `admin=true` para `roles` `["admin"]`, `["leitor","admin"]` e `"admin"`; 200 com `admin=false` para `roles` ausente, `[]`, `["Admin"]`, `["leitor"]`, `true`, `1` e objeto — nunca 401 por causa da claim; o corpo tem exatamente `login`, `nome`, `email`, `admin`; per FR-080, FR-086, US6/AC2
- [X] T125 [P] [US6] [BACKEND] Teste que percorre as rotas de escrita em `backend/tests/Jotanunes.Docs.Api.Tests/Autorizacao/PerfilAdminTests.cs` (usa `Rota.Registradas` de `Autorizacao/Rotas.cs`): (a) o conjunto de rotas `/api/fluig/*` com método ≠ GET registradas na API DEVE ser igual a `ExigemAdmin` (as 10 operações `x-requer-admin` do contrato: POST/PUT obras, PUT/DELETE vínculo, POST/PUT empresas, POST/PUT tipos-documento, POST aprovar, POST rejeitar) ∪ `PermitidasAoComum` (`POST /api/fluig/empresas/{empresaId}/convites`) — rota nova sem classificação faz o teste falhar; (b) para cada rota de `ExigemAdmin`, com `Tokens.FluigComum`: corpo `{}` e ids aleatórios → 403 `application/problem+json` com `code=SEM_PERMISSAO` e `title` "Só administradores podem fazer isso. Se você precisa, fale com a TI." (prova que vem antes de validação e de 404), e com dados válidos semeados → 403 igual e contagens de `obras`, `empresas`, `obra_empresas`, `tipos_documento`, `envios_documento` por status e e-mails do `EnviadorEmailFake` inalteradas; (c) para cada rota de `ExigemAdmin`, com token admin e dados válidos semeados (`Infra/Semente.cs`) → 2xx do contrato (201/200/204); (d) com token comum: `POST .../convites` → 201 e todas as rotas GET `/api/fluig/*` → nunca 403 (200 com dados semeados, incluindo download de arquivo); (e) sem token continua 401 (não 403) em `ExigemAdmin`; per FR-081, FR-082, FR-083, SC-009, US6/AC3–AC5, Constitution III/IV v1.1.0
- [X] T126 [P] [US6] [BACKEND] Testes de auditoria por perfil em `backend/tests/Jotanunes.Docs.Api.Tests/Autorizacao/AuditoriaPerfilTests.cs` (helper `Infra/AuditoriaTeste.cs`): comum chamando `POST /api/fluig/tipos-documento` grava 1 linha `PERMISSAO_NEGADA` com `ator_tipo=FLUIG`, `ator_id=joao.comum`, `ator_admin=false`, `recurso_tipo=OPERACAO`, `recurso_id=fluigCriarTipoDocumento` e sem corpo/token; `CONVITE_ENVIADO` e `ARQUIVO_BAIXADO` pelo comum → `ator_admin=false`; `ENVIO_APROVADO`/`ENVIO_REJEITADO` e `ARQUIVO_BAIXADO` pelo admin → `ator_admin=true`; linhas do portal (`LOGIN_*`, `DOCUMENTO_ENVIADO`) → `ator_admin` nulo; per FR-061, FR-085, US6/AC8
- [X] T127 [P] [US6] [BACKEND] Estender `backend/tests/Jotanunes.Docs.Api.Tests/Contrato/ContratoOpenApiTests.cs`: o conjunto de `operationId` com `x-requer-admin: true` no `openapi.yaml` (lido de `Extensions` da operação) DEVE ser igual ao conjunto de endpoints cujo metadado `IAuthorizeData` inclui a política `FluigAdmin` (nome do endpoint via `IEndpointNameMetadata`); `SEM_PERMISSAO` coberto pela checagem já existente de `CodigoErro`; per FR-083, SC-009, Constitution II

### Implementation for User Story 6 (BACKEND)

- [X] T128 [US6] [BACKEND] Perfil na identidade: `CodigoErro.SEM_PERMISSAO` em `backend/src/Jotanunes.Docs.Application/Erros/` e na tabela de `title`/status 403 usada pelo `Problemas` da `Api`; `bool EhAdmin { get; }` em `IUsuarioFluigAtual` (`backend/src/Jotanunes.Docs.Application/Portas/Servicos.cs`); `PapeisFluig.Admin = "admin"` e `UsuarioFluigAtualDeClaims.EhAdmin` em `backend/src/Jotanunes.Docs.Api/Autenticacao/Autenticacao.cs` seguindo a tabela de `fluig-identity.md` (claims `roles` repetidas ou texto único; comparação exata; tipo inesperado = false); `GET /api/fluig/me` devolve `admin` em `backend/src/Jotanunes.Docs.Api/Endpoints/Fluig/SessaoEndpoints.cs`; atualizar fakes de `IUsuarioFluigAtual` em `backend/tests/Jotanunes.Docs.Application.Tests/` e asserções de corpo do `/me` em `Autorizacao/EsquemasTests.cs` se compararem o objeto inteiro; per FR-080, FR-086
- [X] T129 [US6] [BACKEND] Política `Politicas.FluigAdmin` (esquema `Fluig` + autenticado + `PapelAdminRequirement` com handler que usa a mesma regra de `EhAdmin`) em `backend/src/Jotanunes.Docs.Api/Autenticacao/Autenticacao.cs`; `ResultadoAutorizacaoHandler` passa a olhar `result.AuthorizationFailure.FailedRequirements`: `PapelAdminRequirement` → grava `PERMISSAO_NEGADA` (via `IRegistroAuditoria` + `IUnidadeTrabalho` de `context.RequestServices`, `recurso_id` = `IEndpointNameMetadata.EndpointName`) e escreve 403 `SEM_PERMISSAO`; `TrocaSenhaConcluidaRequirement` → `TROCA_SENHA_OBRIGATORIA` como hoje; aplicar `.RequireAuthorization(Politicas.FluigAdmin)` exatamente às 10 operações `x-requer-admin` em `backend/src/Jotanunes.Docs.Api/Endpoints/Fluig/ObrasEndpoints.cs`, `EmpresasEndpoints.cs`, `TiposDocumentoEndpoints.cs` e `AnaliseEndpoints.cs` (convites e GETs ficam só com `Fluig`), per FR-081, FR-083, FR-085
- [X] T130 [US6] [BACKEND] Auditoria com perfil: `AcaoAuditoria.PermissaoNegada = "PERMISSAO_NEGADA"` e propriedade `bool? AtorAdmin` em `backend/src/Jotanunes.Docs.Domain/Auditoria/RegistroAuditoria.cs`; mapeamento `ator_admin boolean null` no `DocsDbContext`; migration `PerfilAdminAuditoria` em `backend/src/Jotanunes.Docs.Infrastructure/Persistencia/Migrations/` (coluna nullable, sem backfill); `RegistroAuditoriaEf` preenche `AtorAdmin` com `IUsuarioFluigAtual.EhAdmin` quando `atorTipo = FLUIG` e `null` nos outros casos, sem mudar a assinatura de `IRegistroAuditoria` (data-model §7), per FR-061, FR-085

### Tests for User Story 7 (BACKEND) ⚠️

- [X] T131 [P] [US7] [BACKEND] Testes unitários em `backend/tests/Jotanunes.Docs.Application.Tests/TiposDocumento/CatalogoTiposPadraoTests.cs`: `CatalogoTiposPadrao` tem exatamente os 10 nomes e instruções de `data-model.md` §4.1, na ordem, nomes únicos sem diferenciar maiúsculas e todos aceitos por `TipoDocumento.Criar` (3–120; instruções não vazias ≤ 1000); `SemearCatalogoTiposPadrao` com repositório fake vazio cria 10 tipos ativos com autor `sistema`; com 1 tipo inativo existente não cria nada; chamado 2 vezes seguidas cria só na primeira; per FR-090, FR-091, FR-093
- [X] T132 [P] [US7] [BACKEND] Testes de integração em `backend/tests/Jotanunes.Docs.Api.Tests/TiposDocumento/CatalogoPadraoTests.cs` com `Catalogo:SemearTiposPadrao=true` e banco limpo do Testcontainers: após subir, `GET /api/fluig/tipos-documento` devolve os 10 tipos ativos com instruções e `criado_por_login = 'sistema'` no banco; subir um segundo host sobre o mesmo banco → continua 10; 5 execuções simultâneas do semeador (`Task.WhenAll`) sobre banco vazio → exatamente 10 e nenhuma exceção; banco com 1 tipo inativo inserido antes de subir → continua 1; tipo padrão editado e desativado pelo admin e novo host → edição e desativação mantidas; empresa ativa criada antes → `documentos.total = 10`, `pendentes = 10`; `Catalogo:SemearTiposPadrao=false` → 0 tipos; per FR-090, FR-091, FR-092, FR-015, SC-010, US7/AC1–AC5

### Implementation for User Story 7 (BACKEND)

- [X] T133 [US7] [BACKEND] Catálogo e semeador em `backend/src/Jotanunes.Docs.Application/TiposDocumento/CatalogoTiposPadrao.cs` (lista imutável com os textos de `data-model.md` §4.1) e `backend/src/Jotanunes.Docs.Application/TiposDocumento/SemearCatalogoTiposPadrao.cs` (research R15: bloqueio exclusivo → `ExisteAlgumAsync` → cria os 10 com `TipoDocumento.Criar(..., autor: "sistema")` → um único `SalvarAsync`; `ErroAplicacao(NOME_DUPLICADO)` na corrida vira log `Information` e retorno normal); `Task<bool> ExisteAlgumAsync(ct)` em `ITipoDocumentoRepositorio` (`Portas/Persistencia.cs`) + implementação em `backend/src/Jotanunes.Docs.Infrastructure/Persistencia/Repositorios/`; porta `IBloqueioExclusivo.AdquirirAsync(long chave, ct)` implementada em `backend/src/Jotanunes.Docs.Infrastructure/Persistencia/BloqueioExclusivoPostgres.cs` com `pg_advisory_xact_lock` dentro da transação da unidade de trabalho; per FR-090, FR-091, FR-093
- [X] T134 [US7] [BACKEND] Ligar na inicialização em `backend/src/Jotanunes.Docs.Api/Program.cs`: depois do bloco de migrations (e também quando `Database:MigrateOnStartup=false`), se `Catalogo:SemearTiposPadrao` (padrão `true` em `appsettings.json`), executar `SemearCatalogoTiposPadrao` num escopo de DI; `ApiFactory` em `backend/tests/Jotanunes.Docs.Api.Tests/Infra/ApiFactory.cs` define `Catalogo:SemearTiposPadrao=false` por padrão com opção de ligar; documentar a variável `Catalogo__SemearTiposPadrao` em `backend/README.md`; per FR-090, FR-091

### INFRA (agente BACKEND+INFRA)

- [X] T135 [P] [US6] [INFRA] `scripts/gerar-token-fluig-dev.mjs`: aceitar a opção `--admin` em qualquer posição (removida da lista de argumentos posicionais `[login] [nome] [email]`); com `--admin` o payload ganha `"roles": ["admin"]`, sem ela a claim é omitida (usuário comum); opção desconhecida começando com `--` → mensagem de uso e saída 1; atualizar o comentário de uso no topo; conferir decodificando o payload (`node -e` com `Buffer.from(parte, 'base64url')`) que os dois casos batem com `contracts/fluig-identity.md`; acrescentar em `README.md` (raiz) uma linha sobre os perfis e os dois comandos de token do quickstart §3; per FR-080, quickstart §3

### Implementation for User Story 6 (FLUIG)

- [X] T136 [US6] [FLUIG] Regenerar `fluig-app/src/api/schema.d.ts` (`npm run gen:api`) a partir do contrato 1.1.0; acrescentar `SEM_PERMISSAO` em `MENSAGENS_ERRO` ("Só administradores podem fazer isso. Se você precisa, fale com a TI.") e `STATUS_ERRO` (403) de `fluig-app/src/api/mensagens.ts`; em `fluig-app/src/api/client.ts` garantir que 403 vira `ErroApi` exibível sem disparar `jn:nao-autenticado`; conferir que `UsuarioFluig` em `fluig-app/src/api/tipos.ts` já traz `admin`; `npm run build` e `npm test` verdes; per FR-083, FR-084, FR-086
- [X] T137 [US6] [FLUIG] Mocks por perfil: em `fluig-app/src/mocks/dados.ts` o perfil do mock (`admin` por padrão; `VITE_MOCK_PERFIL=comum` no dev) com funções `definirPerfilMock('admin' | 'comum')` para testes (reset para `admin` no `resetHandlers` de `fluig-app/src/test/setup.ts`); `fluig-app/src/mocks/handlers/sessao.ts` devolve `admin`; helper `exigirAdmin()` em `fluig-app/src/mocks/util.ts` que responde 403 `SEM_PERMISSAO` (problem+json do contrato) quando o perfil é comum, aplicado às 10 operações `x-requer-admin` em `handlers/obras.ts`, `handlers/empresas.ts`, `handlers/tiposDocumento.ts` e `handlers/analise.ts` (convites continuam liberados); documentar `VITE_MOCK_PERFIL` em `fluig-app/.env.example`; per FR-083 (mocks conformes ao contrato), Constitution II
- [X] T138 [US6] [FLUIG] Perfil na interface: `useEhAdmin()` em `fluig-app/src/auth/contexto.ts` (lê `admin` do usuário do `AuthFluigProvider`); componentes `fluig-app/src/components/SomenteAdmin.tsx` (renderiza os filhos só para administrador; nada para comum) e `fluig-app/src/components/AvisoSomenteAdmin.tsx` (+ `AvisoSomenteAdmin.css`, classes `jn-`, texto "Só administradores podem cadastrar, alterar ou analisar. Se você precisa, fale com a TI.", ícone SVG de informação + texto, contraste AA, `role="note"`; não renderiza para administrador); decisão de UX: **esconder** ações e explicar uma vez por tela (research R16), nunca botão desabilitado; testes em `fluig-app/src/components/SomenteAdmin.test.tsx`; per FR-084
- [X] T139 [US6] [FLUIG] Aplicar o perfil nas telas de cadastro: `fluig-app/src/pages/TiposDocumento.tsx` (esconder "Novo tipo", editar e ativar/desativar; aviso no topo), `fluig-app/src/pages/Obras.tsx` (esconder "Nova obra"; aviso), `fluig-app/src/pages/ObraDetalhe.tsx` (dados em modo leitura em vez de `FormularioObra`; esconder ativar/desativar, vincular e desvincular; aviso), `fluig-app/src/pages/Empresas.tsx` (esconder "Nova empresa"; aviso) e `fluig-app/src/pages/EmpresaDetalhe.tsx` (dados em modo leitura em vez de `FormularioEmpresa`; esconder ativar/desativar; **manter** "Enviar/Reenviar convite" em `fluig-app/src/pages/empresa/SecaoAcessoPortal.tsx` e documentos/histórico para os dois perfis; aviso); em todas, `ErroApi` com `code=SEM_PERMISSAO` mostra o `title` no `Alerta` da tela, fecha o modal e mantém os dados (sem ir para "Abra este sistema pelo Fluig."), per FR-081, FR-082, FR-084, US6/AC2, AC4–AC6
- [X] T140 [US6] [FLUIG] Aplicar o perfil na análise: `fluig-app/src/pages/EnvioAnalise.tsx` (esconder "Aprovar"/"Rejeitar" e o modal de motivo para comum; manter dados e "Abrir arquivo"; aviso; `SEM_PERMISSAO` exibido como em T139) e `fluig-app/src/pages/FilaAnalise.tsx` (link da linha "Analisar →" para administrador e "Ver →" para comum; mesma rota), per FR-042, FR-081, FR-082, FR-084
- [X] T141 [P] [US6] [FLUIG] Testes do perfil comum em `fluig-app/src/pages/Perfil.comum.test.tsx` (com `definirPerfilMock('comum')`): em `Painel`, `Obras`, `ObraDetalhe`, `Empresas`, `EmpresaDetalhe`, `TiposDocumento`, `FilaAnalise` e `EnvioAnalise` os dados do mock aparecem, nenhum botão/controle de administrador existe (consultas por nome: "Novo tipo", "Nova obra", "Nova empresa", "Editar", "Salvar", "Ativar", "Desativar", "Vincular empresa", "Desvincular", "Aprovar", "Rejeitar") e o aviso aparece uma vez; em `EmpresaDetalhe` "Enviar convite" funciona e muda o selo para "Convidada"; em `EnvioAnalise` "Abrir arquivo" chama o download; na fila o link é "Ver →"; com perfil admin (padrão) o aviso não aparece e os botões existem; per FR-082, FR-084, US6/AC2, AC4, AC5
- [X] T142 [P] [US6] [FLUIG] Testes de 403 em `fluig-app/src/pages/Perfil.semPermissao.test.tsx`: com UI de administrador mas servidor respondendo 403 `SEM_PERMISSAO` (via `server.use`) ao criar tipo, salvar obra, vincular empresa e aprovar envio → a mensagem "Só administradores podem fazer isso. Se você precisa, fale com a TI." aparece, os dados da tela continuam, o modal fecha e a tela "Abra este sistema pelo Fluig." **não** aparece; per FR-084, US6/AC6
- [X] T143 [US6] [FLUIG] Atualizar `fluig-app/README.md`: perfis (administrador × comum, claim `roles`), `VITE_MOCK_PERFIL`, e os tokens de dev `--admin`/comum do quickstart §3; per FR-080

### PORTAL

- [X] T144 [P] [PORTAL] Regenerar `portal/src/api/schema.d.ts` (`npm run gen:api`) a partir do contrato 1.1.0 e acrescentar `SEM_PERMISSAO` em `MENSAGENS` de `portal/src/api/mensagens.ts` (exigido por `Record<CodigoErro, string>`; o portal nunca recebe esse código); sem mudança de comportamento; `npm run build` e `npm test` verdes; per Constitution II (tipos gerados do contrato 1.1.0)

### INFRA (final)

- [X] T145 [INFRA] Executar o roteiro E2E de `specs/001-portal-documentos-terceirizadas/quickstart.md` §6 com banco vazio e as áreas integradas (`VITE_USE_MOCKS=false`), com foco nos passos 2–3, 5, 13 e 31–38 (tokens admin e comum; catálogo padrão; reinícios), e registrar divergências para a área responsável; per SC-009, SC-010, US6, US7

### Phase 10 — Dependencies & Execution Order

- **Contrato**: pronto (1.1.0). BACKEND e FLUIG começam juntos.
- **BACKEND**: T123 → (T124, T125, T126, T127 em paralelo, devem falhar) → T128 → T129 → T130;
  US7: (T131, T132) → T133 → T134. US6 e US7 podem se intercalar; T130 e T133 geram coisas
  diferentes (migration só em T130; T133 não cria migration).
- **INFRA**: T135 independente (qualquer momento); T145 depois de BACKEND e FLUIG.
- **FLUIG**: T136 → T137 → T138 → (T139, T140) → (T141, T142) → T143. Não depende do backend (MSW).
- **PORTAL**: T144 independente.
- **Entre áreas**: só o contrato (leitura). O script de token (T135) não é usado por nenhum teste
  automatizado.

### Phase 10 — Parallel Example

```bash
# Agente BACKEND+INFRA
Task: "PerfilClaimTests.cs"   Task: "PerfilAdminTests.cs"   Task: "AuditoriaPerfilTests.cs"
Task: "CatalogoTiposPadraoTests.cs"   Task: "CatalogoPadraoTests.cs"   Task: "gerar-token-fluig-dev.mjs --admin"

# Agente FLUIG (ao mesmo tempo, com MSW)
Task: "schema + mensagens + client (T136)" → "mocks por perfil (T137)" → "SomenteAdmin/AvisoSomenteAdmin (T138)"
```

---

## Phase 11: Login próprio da área Jotanunes e usuários internos (US8 P1, US9 P1, US10 P1)

**Purpose**: decisão do dono do produto de 2026-09-29 (tarde) — spec "Session 2026-09-29 (tarde)":
a Jotanunes ainda não tem o Fluig, então a área Jotanunes ganha **login próprio** (US8), **usuários
internos** gerenciados na tela "Usuários" só por administradores (US9) e **primeiro administrador**
criado por comando na instalação (US10); a entrada pelo Fluig não muda. FR-100–FR-116,
SC-011–SC-016. Desenho em research **R17**, plan "Autenticação" (tabela da Phase 11) e "Login próprio
e usuários internos", data-model **§10** (+ §7, §8). Contrato **1.2.0** e `fluig-identity.md` (Parte 2)
já atualizados; constituição **1.2.0**. Nenhum agente edita o contrato.

**Agentes**: **BACKEND+INFRA** (`backend/`, `scripts/`, `deploy/`, `README.md`, `.env.example`) e
**FLUIG** (`fluig-app/`) em paralelo; nenhuma tarefa de um exige editar arquivos do outro. `[PORTAL]`
T175 é pequena e independente (orquestrador). `[INFRA]` T176 (E2E) roda por último.

**Independent Test**: quickstart §6 passos 1 e 39–56 (e regressão dos passos 2, 31 e 34–36 com
tokens Fluig).

**Constantes do desenho (usar exatamente)**: token local `iss = jotanunes-docs`,
`aud = jotanunes-docs-api`, HS256 com `Auth:LoginLocal:Secret`, 8 h, claims `sub`, `name`, `email`,
`roles` (`["admin"]` ou omitida), `uid`, `ver`, `troca_senha`; esquemas `Fluig`, `LoginLocal` e seletor
`AreaJotanunes`; políticas `Fluig` (+ `SenhaLocalDefinidaRequirement`), `FluigSessao`, `FluigAdmin`;
senha provisória 12 caracteres, 7 dias; bloqueio 5 falhas / 15 min; login `trim` + minúsculas,
`^[a-z0-9._-]{3,100}$`; configuração `Auth:LoginLocal:Habilitado` (padrão `true`),
`Auth:LoginLocal:Secret`, `FluigApp:BaseUrl`.

### Tests for Phase 11 (BACKEND) ⚠️ — escrever antes, ver falhar

- [X] T146 [US8] [BACKEND] Base dos testes: em `backend/tests/Jotanunes.Docs.Api.Tests/Infra/ApiFactory.cs` configurar `Auth:LoginLocal:Secret` (32+ bytes, diferente dos segredos Fluig/Portal), `Auth:LoginLocal:Habilitado=true` (com opção de desligar por fábrica) e `FluigApp:BaseUrl=http://fluig.teste`; em `Infra/Semente.cs` o helper `UsuarioInterno(login, nome, email, admin, ativo, senha, trocaSenhaObrigatoria, senhaProvisoriaExpiraEm)` que grava direto no banco com hash BCrypt; em `Infra/Tokens.cs` `Tokens.Local(api, usuario)` (token válido com `ver`/`uid` do banco) e `Tokens.LocalBruto(...)` para forjar variações (`iss`, segredo, `uid`, `ver`, `troca_senha` ausente, `alg=none`, validade > 8 h), e `Tokens.LocalComum`/`Tokens.LocalAdmin` que semeiam o usuário e devolvem o token. Rodar a suíte inteira: nenhum teste existente muda de resultado; per FR-100, R17
- [X] T147 [P] [US8] [BACKEND] Testes de domínio em `backend/tests/Jotanunes.Docs.Domain.Tests/UsuariosInternos/UsuarioInternoTests.cs`: login normalizado (`" Ana.Souza "` → `ana.souza`) e recusado fora de `^[a-z0-9._-]{3,100}$` (acento, espaço no meio, 2 ou 101 caracteres); `nome` 3–150; e-mail válido ≤ 254 em minúsculas; `Criar` → `admin` conforme pedido, `ativo=true`, `troca_senha_obrigatoria=true`, `senha_provisoria_expira_em = agora + 7 dias`, `versao_credencial = 0`; `TrocarSenha` segue `PoliticaSenha` (`SENHA_FRACA`), zera expiração, `troca=false`, versão +1; `RegistrarFalhaLogin` bloqueia 15 min na 5ª falha e sucesso zera; `RedefinirSenha` → nova hash, troca obrigatória, +7 dias, zera tentativas e `bloqueado_ate`, versão +1; `Desativar`/`Reativar`/`DefinirAdmin(valor diferente)` → versão +1; `AtualizarDados(nome, email)` não muda a versão; `Situacao(agora)` devolve os 4 valores de `data-model.md` §10; per FR-102, FR-103, FR-104, FR-106, FR-109
- [X] T148 [P] [US8] [BACKEND] Testes de login em `backend/tests/Jotanunes.Docs.Api.Tests/AcessoJotanunes/LoginLocalTests.cs`: `POST /api/fluig/auth/login` → 200 `SessaoJotanunes` (`usuario.origem=LOGIN_LOCAL`); token decodificado com `iss=jotanunes-docs`, `aud=jotanunes-docs-api`, `sub`, `name`, `email`, `roles=["admin"]` só para admin (omitida para comum), `uid`, `ver`, `troca_senha`, `exp − iat = 8 h`; login com maiúsculas/espaços funciona; senha errada e login inexistente → 401 `LOGIN_INVALIDO` com `title` "Login ou senha incorretos." e corpo com as mesmas chaves; **anti-enumeração**: 6 tentativas com login existente, com login inexistente e com login em formato inválido produzem a mesma sequência 401×5 → 423 `ACESSO_BLOQUEADO` com `bloqueadoAte`; usuário bloqueado com a senha certa → 423; desativado com a senha certa → 403 `USUARIO_INATIVO` (com a errada → 401 `LOGIN_INVALIDO`); senha provisória vencida (`FakeTimeProvider` + 7 dias) → 401 `SENHA_PROVISORIA_EXPIRADA`; 11ª requisição/min do mesmo IP somando `POST /api/portal/auth/login` e `POST /api/fluig/auth/login` → 429 `LIMITE_REQUISICOES`; `GET /api/fluig/auth/configuracao` sem token → 200 `{loginLocalHabilitado:true}` com `Cache-Control: no-store`; com `Auth:LoginLocal:Habilitado=false` → `{loginLocalHabilitado:false}`, login/trocar-senha/sair → 404 `NAO_ENCONTRADO` e um token local válido → 401 em `GET /api/fluig/me`; auditoria: `LOGIN_SUCESSO` (`ator_tipo=LOCAL`, `recurso_tipo=USUARIO_INTERNO`, `recurso_id`=id), `LOGIN_FALHA`/`LOGIN_BLOQUEADO` (`ANONIMO`, `ator_id` = login normalizado só quando tem o formato de login, senão nulo), recusas com senha certa também gravam `LOGIN_FALHA`; o log capturado não contém a senha digitada; per FR-101, FR-104, FR-113, FR-114, SC-014
- [X] T149 [P] [US8] [BACKEND] Testes de troca de senha e sessão em `backend/tests/Jotanunes.Docs.Api.Tests/AcessoJotanunes/SessaoLocalTests.cs`: com `troca_senha=true`, `GET /api/fluig/me` → 200 com `trocaSenhaObrigatoria=true`, e **toda** outra rota `/api/fluig/*` autenticada (enumerada via `Rota.Registradas`) → 403 `TROCA_SENHA_OBRIGATORIA`, inclusive rotas `x-requer-admin` com token de admin pendente, sem linha `PERMISSAO_NEGADA`; `POST /api/fluig/auth/trocar-senha`: nova fraca → 400 `SENHA_FRACA`, atual errada → 400 `SENHA_ATUAL_INCORRETA`, sucesso → 200 com token novo (`troca_senha=false`), token anterior → 401, senha provisória não entra mais, auditoria `SENHA_TROCADA`; troca voluntária (sem pendência) funciona igual; com token Fluig → 409 `SO_LOGIN_LOCAL`; `POST /api/fluig/auth/sair` com token local → 204, `SESSAO_ENCERRADA` na auditoria e o mesmo token → 401 na requisição seguinte; `sair` com troca pendente → 204; `sair` com token Fluig → 204 e o token Fluig continua valendo; per FR-102, FR-105, FR-106
- [X] T150 [P] [US9] [BACKEND] Testes de revogação em `backend/tests/Jotanunes.Docs.Api.Tests/Autorizacao/RevogacaoLoginLocalTests.cs`: com um token local válido de usuário comum, cada ação a seguir faz a próxima requisição com o token antigo dar 401 `NAO_AUTENTICADO`: admin desativa (`PUT ... ativo=false`); admin dá o papel de administrador (e o novo login traz `roles=["admin"]`); admin tira o papel de um administrador (novo login sem `roles`); admin redefine a senha; o próprio usuário troca a senha; o próprio usuário sai; e **não** dá 401 quando o admin muda só nome/e-mail; token com `ver` antigo, com `uid` de outro usuário ou com `sub` diferente do login do `uid` → 401; per FR-106, SC-013, Constitution III v1.2.0
- [X] T151 [P] [US9] [BACKEND] Testes da gestão em `backend/tests/Jotanunes.Docs.Api.Tests/UsuariosInternos/UsuariosInternosTests.cs`: `POST /api/fluig/usuarios` (admin) → 201 + `Location`, `situacao=AGUARDANDO_PRIMEIRO_ACESSO`, `criadoPor` = login do admin, login gravado em minúsculas; e-mail fake para o `email` com login, senha provisória de 12 caracteres, link `FluigApp:BaseUrl` e validade de 7 dias; resposta e banco sem a senha em texto (`senha_hash` BCrypt custo 12); login repetido com outra caixa → 409 `LOGIN_DUPLICADO`; `VALIDACAO` com `errors.login`/`errors.nome`/`errors.email`; e-mail falhando → 502 `EMAIL_ACESSO_FALHOU` e nenhuma linha em `usuarios_internos`; `GET` lista ordenada por nome com `busca` (nome/login/e-mail), `ativo`, `admin` e paginação; `GET {id}` 200/404; `PUT` nome/e-mail → 200; sessão local de admin desativando a si mesma ou tirando o próprio papel → 409 `ALTERACAO_PROPRIA_NAO_PERMITIDA` sem mudança; token **Fluig** admin tirando o papel ou desativando o único admin interno ativo → 409 `ULTIMO_ADMINISTRADOR`; com 2 admins, tirar um → 200; 2 admins internos e duas requisições simultâneas (`Task.WhenAll`, token Fluig admin) desativando um cada → exatamente um 200 e um 409 `ULTIMO_ADMINISTRADOR`; `POST .../redefinir-senha` → 200, novo e-mail, `situacao=AGUARDANDO_PRIMEIRO_ACESSO`, `bloqueadoAte` nulo, senha antiga recusada; usuário inativo → 409 `USUARIO_INATIVO`; e-mail falhando → 502 e a senha antiga continua valendo; auditoria `USUARIO_CRIADO`, `USUARIO_ATUALIZADO`, `USUARIO_DESATIVADO`, `USUARIO_REATIVADO`, `SENHA_REDEFINIDA` com `recurso_tipo=USUARIO_INTERNO`, `ator_tipo` `LOCAL` ou `FLUIG` conforme o token e `ator_admin=true`; o log capturado não contém nenhuma senha provisória; per FR-102, FR-108, FR-109, FR-110, FR-112, FR-113, US9/AC1–AC12
- [X] T152 [P] [US9] [BACKEND] Atualizar o teste que percorre as rotas em `backend/tests/Jotanunes.Docs.Api.Tests/Autorizacao/PerfilAdminTests.cs` (e `Autorizacao/Rotas.cs`): listas explícitas `ExigemAdmin` (as 10 de antes + `GET`/`POST /api/fluig/usuarios`, `GET`/`PUT /api/fluig/usuarios/{usuarioId}`, `POST /api/fluig/usuarios/{usuarioId}/redefinir-senha`), `PermitidasAoComum` (`POST .../convites`), `Anonimas` (`GET /api/fluig/auth/configuracao`, `POST /api/fluig/auth/login`) e `Sessao` (`GET /api/fluig/me`, `POST /api/fluig/auth/trocar-senha`, `POST /api/fluig/auth/sair`); toda rota `/api/fluig/*` com método ≠ GET DEVE estar numa das listas e todo GET `x-requer-admin` em `ExigemAdmin` (rota nova sem classificação falha); os cenários (b) 403 `SEM_PERMISSAO` com banco e e-mails inalterados, (c) 2xx do admin, (d) GETs fora de `ExigemAdmin` nunca 403 para comum e (e) 401 sem token passam a rodar **para as duas origens** (`[Theory]` com `Tokens.FluigComum`/`Tokens.Fluig` e `Tokens.LocalComum`/`Tokens.LocalAdmin`); em `Autorizacao/FluigRotasTests.cs`, as rotas de `Anonimas` saem da checagem "sem token → 401" e o teste confere que elas são exatamente as anônimas (sem token ≠ 401) e as demais continuam 401 sem token e com token do portal; em `Autorizacao/AuditoriaPerfilTests.cs`, `PERMISSAO_NEGADA` de comum local → `ator_tipo=LOCAL`, `ator_admin=false`; per FR-107, FR-108, SC-009, SC-012, Constitution IV v1.2.0
- [X] T153 [P] [US8] [BACKEND] Separação de esquemas e **Fluig inalterado** em `backend/tests/Jotanunes.Docs.Api.Tests/Autorizacao/EsquemasTests.cs` e `Autorizacao/PerfilClaimTests.cs`: token Fluig continua 200 em `/api/fluig/me` com `origem=FLUIG` e `trocaSenhaObrigatoria=false` e em todas as rotas como antes (casos existentes sem mudança); corpo do `/me` tem exatamente `login`, `nome`, `email`, `admin`, `origem`, `trocaSenhaObrigatoria`; token local em `GET /api/portal/me` → 401; token do portal em `/api/fluig/me` → 401; `iss=jotanunes-docs` assinado com o segredo do Fluig → 401; `iss=fluig` assinado com o segredo local → 401; token local com `alg=none`, validade > 8 h ou sem `uid`/`ver`/`troca_senha` → 401; em `Autorizacao/IsolamentoEmpresasTests.cs`, todas as rotas `/api/portal/*` autenticadas com token local → 401; per FR-002, FR-115, SC-003, SC-016
- [X] T154 [P] [US10] [BACKEND] Testes do comando em `backend/tests/Jotanunes.Docs.Api.Tests/UsuariosInternos/CriarAdminComandoTests.cs` (chamando `ComandoCriarAdmin.ExecutarAsync(servicos, args, StringWriter saida, StringWriter erro)` sobre o banco do Testcontainers): banco sem usuários → código 0, usuário `admin=true`, `ativo=true`, `AGUARDANDO_PRIMEIRO_ACESSO`, `criado_por_login='sistema'`, a saída contém a senha provisória (BCrypt confere com o hash) e ela é igual à do e-mail fake; o **log capturado não contém a senha**; auditoria `USUARIO_CRIADO` com `ator_tipo=SISTEMA`, `ator_id=sistema`; segunda execução → código 2, nada alterado, nenhum e-mail; `--forcar` com login existente comum e inativo → vira admin ativo, nova senha, `versao_credencial` +1 e o token antigo dele → 401; `--forcar` com login novo → cria; argumentos faltando, login inválido ou e-mail inválido → código 1 com uso no `erro`; `Auth:LoginLocal:Habilitado=false` → código 1; e-mail falhando → código 0, usuário criado, senha na saída e aviso no `erro`; duas execuções simultâneas em banco vazio → uma 0 e outra 2 (um só administrador); per FR-111, FR-112, US10/AC1–AC6, SC-015, Constitution III v1.2.0
- [X] T155 [P] [US8] [BACKEND] Configuração em `backend/tests/Jotanunes.Docs.Api.Tests/Seguranca/ValidacaoConfiguracaoTests.cs`: com o login próprio ligado, `Auth:LoginLocal:Secret` ausente, < 32 bytes, igual ao do Fluig ou igual ao do portal → erro; `FluigApp:BaseUrl` ausente fora de Development → erro; `Auth:Fluig:Issuer = jotanunes-docs` → erro; com `Auth:LoginLocal:Habilitado=false`, nada disso é exigido (exceto o emissor do Fluig); rodar `Contrato/ContratoOpenApiTests.cs` sem mudança (rotas, `CodigoErro` e `x-requer-admin` — agora inclusive em GET — batem com a API) e ajustar só se ele assumir que `x-requer-admin` é exclusivo de escrita; per FR-100, R17, Constitution II

### Implementation for Phase 11 (BACKEND)

- [X] T156 [US8] [BACKEND] Domínio em `backend/src/Jotanunes.Docs.Domain/UsuariosInternos/`: `UsuarioInterno.cs` (campos e regras de `data-model.md` §10 — `login varchar(100)` único e imutável, `nome` 3–150, `email` ≤ 254, `senha_provisoria_expira_em` = +7 dias, `versao_credencial` +1 em desativar/reativar/redefinir/trocar/mudar `admin`/sair; métodos dos testes de T147, reaproveitando `PoliticaSenha` e as constantes de falha/bloqueio de `Empresa`), `LoginUsuario.cs` (VO: normalização e formato) e `SituacaoUsuarioInterno.cs`; em `backend/src/Jotanunes.Docs.Domain/Auditoria/RegistroAuditoria.cs`: `AtorAuditoria.Local = "LOCAL"`, `AtorAuditoria.Sistema = "SISTEMA"`, ações `USUARIO_CRIADO`, `USUARIO_ATUALIZADO`, `USUARIO_DESATIVADO`, `USUARIO_REATIVADO`, `SENHA_REDEFINIDA`, `SESSAO_ENCERRADA`, e `AtorAdmin` preservado para `FLUIG` **e** `LOCAL`; per FR-102–FR-106, FR-109, FR-113
- [X] T157 [US8] [BACKEND] Persistência: porta `IUsuarioInternoRepositorio` (`ObterAsync(id)`, `ObterPorLoginAsync(login)`, `ListarAsync(busca, ativo, admin, pagina)`, `ContarAdministradoresAtivosAsync`, `Adicionar`) em `backend/src/Jotanunes.Docs.Application/Portas/Persistencia.cs`; `ITentativasLoginRepositorio.ObterOuCriarPorLoginLocalAsync(login)`; configuração EF da tabela `usuarios_internos` no `DocsDbContext` com as restrições de `data-model.md` §10 (`login varchar(100)` + índice único `lower(login)`, `nome varchar(150)`, `email varchar(254)`, `senha_hash varchar(100)`, `timestamptz`, índice parcial `(admin, ativo) WHERE admin AND ativo`); repositório em `backend/src/Jotanunes.Docs.Infrastructure/Persistencia/Repositorios/UsuarioInternoRepositorio.cs` traduzindo violação do índice único em `LOGIN_DUPLICADO`; em `TentativasLoginRepositorio.cs`, chave HMAC-SHA256 de `"usuario:" + login` com chave derivada de `Auth:LoginLocal:Secret` e rótulo `jotanunes-docs/tentativas-login-local/v1`; migration `UsuariosInternos` em `backend/src/Jotanunes.Docs.Infrastructure/Persistencia/Migrations/`; per FR-104, FR-109, data-model §8/§10
- [X] T158 [US8] [BACKEND] Segurança e configuração: `OpcoesLoginLocal` (`Habilitado` padrão `true`, `Secret`, emissor `jotanunes-docs`, audiência `jotanunes-docs-api`, 8 h) ligado a `Auth:LoginLocal` e `ConfiguracaoAreaJotanunes { BaseUrl }` ligado a `FluigApp`; porta `IEmissorTokenJotanunes` (`Emitir(UsuarioInterno)` → `accessToken` + `expiraEm`) em `backend/src/Jotanunes.Docs.Application/Portas/Servicos.cs` e `EmissorTokenJotanunes` em `backend/src/Jotanunes.Docs.Infrastructure/Seguranca/Seguranca.cs` com as claims da research R17; `IUsuarioFluigAtual` ganha `bool EhLoginLocal` e `Guid? UsuarioInternoId` (atualizar os fakes em `backend/tests/Jotanunes.Docs.Application.Tests/`); regras novas em `backend/src/Jotanunes.Docs.Api/Configuracao/ValidacaoConfiguracao.cs` (T155); `"Auth": { "LoginLocal": { "Habilitado": true } }` em `appsettings.json` e `FluigApp__BaseUrl=http://localhost:5173` em `Properties/launchSettings.json` (sem segredo); per FR-100, R17
- [X] T159 [US8] [BACKEND] Autenticação em `backend/src/Jotanunes.Docs.Api/Autenticacao/Autenticacao.cs`: esquema JwtBearer `LoginLocal` (mesma função `Comum`, segredo/emissor/audiência de `OpcoesLoginLocal`, `OnTokenValidated` que exige `uid`/`ver`/`troca_senha` e falha se o usuário não existe, está inativo, `versao_credencial ≠ ver` ou `login ≠ sub`); esquema seletor `AreaJotanunes` (`AddPolicyScheme` + `ForwardDefaultSelector` que lê o `iss` do Bearer sem validar: `jotanunes-docs` e login ligado → `LoginLocal`, senão `Fluig`); políticas `Fluig` (+ `SenhaLocalDefinidaRequirement`: passa para token não local ou `troca_senha=false`), `FluigSessao` (sem o requisito) e `FluigAdmin` usando `AreaJotanunes`; `ResultadoAutorizacaoHandler`: falha de `SenhaLocalDefinidaRequirement` → 403 `TROCA_SENHA_OBRIGATORIA` com precedência e sem auditoria, senão regra atual; `UsuarioFluigAtualDeClaims.EhLoginLocal`/`UsuarioInternoId`; em `backend/src/Jotanunes.Docs.Infrastructure/Auditoria/RegistroAuditoriaEf.cs`, `FLUIG` numa sessão local vira `LOCAL` (com `ator_admin`); em `Program.cs`, segundo `MapGroup("/api/fluig").RequireAuthorization(Politicas.FluigSessao)` com `GET /me` (movido de `SessaoEndpoints.cs`), `trocar-senha` e `sair`; `GET /api/fluig/me` devolve `origem` e `trocaSenhaObrigatoria`; per FR-100, FR-106, FR-107, FR-114, FR-115, Constitution III v1.2.0
- [X] T160 [US8] [BACKEND] Casos de uso em `backend/src/Jotanunes.Docs.Application/AcessoJotanunes/` (`ObterConfiguracaoAcesso`, `LoginJotanunes` com a ordem da research R17 e a mesma lógica de bloqueio/BCrypt fictício do `LoginPortal`, `TrocarSenhaJotanunes` — `SO_LOGIN_LOCAL` para sessão Fluig —, `SairJotanunes` — versão +1 e `SESSAO_ENCERRADA`, 204 sem efeito para Fluig) e endpoints em `backend/src/Jotanunes.Docs.Api/Endpoints/Fluig/AcessoJotanunesEndpoints.cs`: `GET /api/fluig/auth/configuracao` (`AllowAnonymous`, `Cache-Control: no-store`), `POST /api/fluig/auth/login` (`AllowAnonymous` + `RequireRateLimiting(LimiteRequisicoes.PoliticaAnonima)`), `trocar-senha` e `sair` no grupo `FluigSessao`; com o login desligado, os três últimos → 404 `NAO_ENCONTRADO`; `CodigoErro` com os 8 códigos novos e seus `title`/status da tabela do contrato em `backend/src/Jotanunes.Docs.Application/Erros/CodigoErro.cs` e no `Problemas` da `Api`; `WithName` = `operationId` do contrato; per FR-101–FR-105, FR-114
- [X] T161 [US9] [BACKEND] Gestão de usuários: `ModelosEmail.AcessoUsuarioInterno(...)` em `backend/src/Jotanunes.Docs.Application/Emails/ModelosEmail.cs` (cadastro e redefinição: login, senha provisória, link `FluigApp:BaseUrl`, validade de 7 dias, tom de `docs/design.md` §9, logo inline como os outros); casos de uso em `backend/src/Jotanunes.Docs.Application/UsuariosInternos/` (`ListarUsuariosInternos`, `ObterUsuarioInterno`, `CriarUsuarioInterno` e `RedefinirSenhaUsuarioInterno` na ordem gravar → e-mail → commit com rollback e `EMAIL_ACESSO_FALHOU`, `AtualizarUsuarioInterno` sob `IBloqueioExclusivo` com a chave constante `BloqueioUsuariosInternos` (a mesma do T162, para serializar tudo que muda o conjunto de administradores): `ALTERACAO_PROPRIA_NAO_PERMITIDA` quando `UsuarioInternoId` = alvo e `ativo=false`/`admin=false`, `ULTIMO_ADMINISTRADOR` quando sobraria zero admin ativo; `USUARIO_INATIVO` ao redefinir inativo; auditoria das ações de data-model §7); endpoints em `backend/src/Jotanunes.Docs.Api/Endpoints/Fluig/UsuariosInternosEndpoints.cs` com as 5 rotas do contrato, **todas** com `.RequireAuthorization(Politicas.FluigAdmin)`, `WithName` = `operationId`, 201 + `Location`; per FR-102, FR-108, FR-110, FR-112, FR-113
- [X] T162 [US10] [BACKEND] Comando `criar-admin`: caso de uso `CriarAdministradorInicial` em `backend/src/Jotanunes.Docs.Application/UsuariosInternos/` (sob `IBloqueioExclusivo` com a chave `BloqueioUsuariosInternos` do T161; regras de research R17: sem admin ativo ou `--forcar` → cria ou promove/reativa/redefine; senão recusa; autoria `sistema`; auditoria `SISTEMA`; commit → e-mail, com falha do e-mail informada no resultado) e `backend/src/Jotanunes.Docs.Api/Comandos/ComandoCriarAdmin.cs` (analisa `--login`, `--nome`, `--email`, `--forcar`; escreve só nos `TextWriter` recebidos — nunca `ILogger`; códigos 0/1/2); em `Program.cs`, depois da validação de configuração e das migrations, `if (args is ["criar-admin", ..]) return await ComandoCriarAdmin.ExecutarAsync(app.Services, args, Console.Out, Console.Error);` sem subir o servidor; documentar em `backend/README.md` (comando, códigos de saída, variáveis `Auth__LoginLocal__*` e `FluigApp__BaseUrl`); per FR-111, FR-112, Constitution III v1.2.0

### INFRA (agente BACKEND+INFRA)

- [X] T163 [US10] [INFRA] Desenvolvimento e documentação na raiz: `AUTH_LOGIN_LOCAL_SECRET=` (comentário: ≥ 32 bytes, diferente dos outros; API: `Auth__LoginLocal__Secret`) em `.env.example`; em `README.md` (raiz): linha da área Jotanunes "aberta pelo Fluig ou com login próprio", `export Auth__LoginLocal__Secret="$AUTH_LOGIN_LOCAL_SECRET"` no início rápido e o comando `dotnet run --project src/Jotanunes.Docs.Api -- criar-admin ...` do quickstart §3; per FR-100, FR-111
- [X] T164 [US10] [INFRA] Produção em `deploy/`: `deploy/publicar.sh` lê `AUTH_LOGIN_LOCAL_SECRET` do `producao.env` (falha com mensagem clara se faltar) e acrescenta ao `api.env` `Auth__LoginLocal__Secret`, `Auth__LoginLocal__Habilitado=true` e `FluigApp__BaseUrl=$FLUIG`, e empacota `deploy/criar-admin.sh`; novo `deploy/criar-admin.sh` (wrapper: `systemd-run --quiet --pipe --wait --collect -p EnvironmentFile=/etc/jotanunes-docs/api.env -p User=jotanunes-docs -p Group=jotanunes-docs -p WorkingDirectory=/opt/jotanunes-docs/api /usr/bin/dotnet /opt/jotanunes-docs/api/Jotanunes.Docs.Api.dll criar-admin "$@"`, devolvendo o código de saída; a senha vai só para o terminal, não para o journal); `deploy/instalar.sh` instala o wrapper em `/usr/local/sbin/jotanunes-docs-criar-admin` (root, 0750) e, ao final, se `select count(*) from usuarios_internos where admin and ativo` der 0 ou falhar, imprime o lembrete com o comando (nunca roda sozinho); `deploy/README.md`: seção "Login próprio e primeiro administrador" (variável nova no `producao.env`, comando, `--forcar` para recuperação, como desligar com `Auth__LoginLocal__Habilitado=false`, endereço da área Jotanunes que vai nos e-mails); conferir `bash -n` nos três scripts (e `shellcheck` se disponível); per FR-100, FR-111, US10

### Implementation for Phase 11 (FLUIG)

- [X] T165 [US8] [FLUIG] Contrato no front: regenerar `fluig-app/src/api/schema.d.ts` (`npm run gen:api`) a partir do contrato 1.2.0; exportar em `fluig-app/src/api/tipos.ts` `OrigemSessao`, `ConfiguracaoAcesso`, `LoginJotanunesInput`, `SessaoJotanunes`, `UsuarioInterno`, `UsuarioInternoInput`, `UsuarioInternoAtualizacao`, `PaginaUsuariosInternos`, `SituacaoUsuarioInterno`; acrescentar os 8 códigos novos em `MENSAGENS_ERRO` e `STATUS_ERRO` de `fluig-app/src/api/mensagens.ts` (títulos exatamente os da tabela `CodigoErro`); funções em `fluig-app/src/api/fluig.ts` (`configuracaoAcesso`, `login`, `trocarSenha`, `sair`, `listarUsuarios`, `obterUsuario`, `criarUsuario`, `atualizarUsuario`, `redefinirSenhaUsuario`), com `configuracaoAcesso`/`login` sem `Authorization` e sem disparar `jn:nao-autenticado` quando o login responde 401 (é erro de credencial, não de sessão); rótulos da situação do usuário interno ("Aguardando primeiro acesso", "Senha provisória expirada", "Ativo", "Desativado") em `fluig-app/src/components/situacoes.ts`; `npm run build` e `npm test` verdes; per FR-114, Constitution II
- [X] T166 [US8] [FLUIG] Mocks: `fluig-app/src/mocks/handlers/acesso.ts` (configuração, login com os usuários do quickstart §5 — `admin.mock`/`Admin1234`, `comum.mock`/`Comum1234`, `novo.mock`/`Temp1234` → `Nova1234`, `inativo.mock` → `USUARIO_INATIVO` —, `LOGIN_INVALIDO`, bloqueio na 6ª falha com `bloqueadoAte`, `SENHA_PROVISORIA_EXPIRADA`, trocar-senha com `SENHA_FRACA`/`SENHA_ATUAL_INCORRETA`, sair) e `fluig-app/src/mocks/handlers/usuarios.ts` (5 rotas com `exigirAdmin()`, `LOGIN_DUPLICADO`, `ULTIMO_ADMINISTRADOR`, `ALTERACAO_PROPRIA_NAO_PERMITIDA`, `USUARIO_INATIVO`, `EMAIL_ACESSO_FALHOU`), registrados em `handlers/index.ts`; em `fluig-app/src/mocks/dados.ts` a sessão do mock (`origem`, `trocaSenhaObrigatoria`, perfil), `definirLoginLocalMock(boolean)` e `definirSessaoMock(...)`, com reset em `fluig-app/src/test/setup.ts` para o padrão atual (admin, origem `FLUIG`) — os testes existentes não mudam; `handlers/sessao.ts` devolve `origem`/`trocaSenhaObrigatoria`; em `fluig-app/src/auth/tokenFluig.ts`, com `VITE_MOCK_LOGIN=true` não há token de dev (mostra a tela de login); documentar `VITE_MOCK_LOGIN` em `fluig-app/.env.example`; per FR-101, Constitution II
- [X] T167 [US8] [FLUIG] Fluxo de sessão em `fluig-app/src/auth/AuthFluigProvider.tsx` e `fluig-app/src/auth/contexto.ts`: estados `login`, `negado`, `trocaSenha`, `ok` (research R17 "Front"); sem token → `api.configuracaoAcesso()` → `Login` (true) ou `AcessoNegado` (false; erro de rede → `EstadoErro` com "Tentar de novo"); `useSessao()` expõe `origem`, `entrar(sessao)` (guarda o token em memória + `sessionStorage['jn.fluigToken']`), `sair()` (chama `api.sair()`, ignora falha, apaga o token e volta ao login) e `atualizarToken`; `trocaSenhaObrigatoria=true` → só `TrocaSenha` (nenhuma rota do app monta); 401 com origem `LOGIN_LOCAL` → tela de login com "Sua sessão expirou. Entre de novo."; 401 com origem `FLUIG` → "Abra este sistema pelo Fluig." (como hoje); token no fragmento continua com prioridade e troca uma sessão local pela do Fluig; per FR-100, FR-101, FR-105, FR-106
- [X] T168 [US8] [FLUIG] Tela `fluig-app/src/pages/Login.tsx` (+ `Login.css`, classes `jn-`, sob `.jn-app`) e `fluig-app/src/assets/logo-jotanunes.png` (cópia de `docs/design-referencias/logo-jotanunes.png`): painel com `--jn-radius-signature` (`20px 0`), logo dentro do painel, título `text-display` "Acesse a documentação de terceirizadas", campos "Login" e "Senha" (rótulos acima, `autocomplete` `username`/`current-password`), botão pill "Acessar" (`--jn-red-500`, hover `--jn-red-700`, estado "Entrando…"), ajuda "Esqueceu a senha? Peça a um administrador do sistema para gerar uma nova."; mensagens por `code` (`LOGIN_INVALIDO`, `ACESSO_BLOQUEADO` com o horário de `bloqueadoAte` em `America/Sao_Paulo`, `USUARIO_INATIVO`, `SENHA_PROVISORIA_EXPIRADA`, `LIMITE_REQUISICOES`, `VALIDACAO` por campo) num `Alerta` com `role="alert"`; aviso de sessão expirada quando vier do provider; sem cabeçalho de marca fora do painel; contraste AA; em 360 px sem rolagem horizontal; per FR-101, FR-104, FR-116, FR-070, FR-071, Constitution V v1.2.0
- [X] T169 [US8] [FLUIG] Tela `fluig-app/src/pages/TrocaSenha.tsx` (+ `TrocaSenha.css`): modo obrigatório ("Crie uma nova senha para continuar.", sem menu, com "Sair") e modo voluntário na rota `/trocar-senha` (com "Cancelar"); campos senha atual, nova e confirmação; regras visíveis (≥ 8, letra e número, diferente da atual) e validação no cliente com as mensagens do contrato; erros `SENHA_FRACA`/`SENHA_ATUAL_INCORRETA`; sucesso guarda o token novo via `useSessao()` e vai ao painel com "Senha alterada."; per FR-102, FR-103, FR-105
- [X] T170 [US9] [FLUIG] Menu e rotas: em `fluig-app/src/components/Layout.tsx` (+ `Layout.css`, ícones SVG novos em `fluig-app/src/components/icons/`) item "Usuários" só para administrador (`useEhAdmin()`), e "Trocar senha" e "Sair" só com `origem=LOGIN_LOCAL` (no rodapé do menu lateral); em `fluig-app/src/App.tsx`, rotas `/usuarios` → `Usuarios` e `/trocar-senha` → `TrocaSenha` (modo voluntário; com origem `FLUIG` redireciona ao painel); per FR-105, FR-108, US8/AC9, US9/AC11
- [X] T171 [US9] [FLUIG] Tela `fluig-app/src/pages/Usuarios.tsx` (+ `Usuarios.css`) e `fluig-app/src/components/FormularioUsuario.tsx`: `TituloPagina` "Usuários"; filtros (busca por nome/login/e-mail, situação ativo/desativado, perfil) no padrão `Filtros`; tabela densa (nome, login, e-mail, perfil em texto, `Selo` da situação, último acesso) com paginação; "Novo usuário" (modal: nome 3–150, e-mail, login `^[A-Za-z0-9._-]{3,100}$`, "Administrador" como caixa de seleção; sucesso: "Pronto. Enviamos a senha provisória para <e-mail>."); "Editar" (login só leitura; nome, e-mail, perfil); "Desativar"/"Reativar" com confirmação ("A pessoa perde o acesso na hora. Continuar?"); "Redefinir senha" com confirmação ("<nome> recebe por e-mail uma nova senha provisória. A senha atual e as sessões abertas deixam de valer. Continuar?"; na própria linha avisa que a sua sessão vai terminar e volta ao login depois); na linha do próprio usuário local, sem "Desativar" e perfil só leitura com a nota "Você não pode tirar o seu próprio acesso de administrador."; erros por `code` (`LOGIN_DUPLICADO` no campo login, `ULTIMO_ADMINISTRADOR`, `ALTERACAO_PROPRIA_NAO_PERMITIDA`, `USUARIO_INATIVO`, `EMAIL_ACESSO_FALHOU`, `SEM_PERMISSAO`) no `Alerta` mantendo os dados; usuário comum em `#/usuarios` vê só `AvisoSomenteAdmin` e **nenhuma** chamada à API; per FR-108–FR-112, US9/AC1–AC11
- [X] T172 [P] [US8] [FLUIG] Testes do acesso: atualizar `fluig-app/src/auth/AuthFluigProvider.test.tsx` (sem token + login ligado → tela de login e nenhum dado; login desligado → "Abra este sistema pelo Fluig."; token no fragmento continua funcionando e **sem** "Sair"; 401 em sessão local → login com "Sua sessão expirou. Entre de novo."; 401 em sessão Fluig → "Abra este sistema pelo Fluig."; fragmento substitui sessão local); criar `fluig-app/src/pages/Login.test.tsx` (sucesso vai ao painel com o nome; `LOGIN_INVALIDO`, bloqueio com horário, `USUARIO_INATIVO` e `SENHA_PROVISORIA_EXPIRADA` exibidos; campos vazios validados no cliente sem chamar a API; token guardado em `sessionStorage`) e `fluig-app/src/pages/TrocaSenha.test.tsx` (login com senha provisória leva à troca e nenhuma rota do app abre; senha fraca recusada no cliente; `SENHA_ATUAL_INCORRETA` exibido; sucesso entra no painel; modo voluntário com "Cancelar"); per FR-100–FR-105, US8/AC1–AC10
- [X] T173 [P] [US9] [FLUIG] Testes da gestão: `fluig-app/src/components/Layout.test.tsx` (admin local vê "Usuários", "Trocar senha" e "Sair"; comum local não vê "Usuários"; sessão Fluig admin vê "Usuários" e não vê "Sair"/"Trocar senha"; "Sair" chama `POST /api/fluig/auth/sair`, limpa o `sessionStorage` e mostra o login) e `fluig-app/src/pages/Usuarios.test.tsx` (lista com situação em texto; criar mostra a mensagem com o e-mail e o usuário na lista; `LOGIN_DUPLICADO` no campo; editar; desativar com confirmação muda o selo; `ULTIMO_ADMINISTRADOR` e `EMAIL_ACESSO_FALHOU` exibidos mantendo os dados; redefinir senha pede confirmação; própria linha sem "Desativar" e com perfil só leitura; comum em `/usuarios` vê o aviso e o handler de usuários não é chamado); per FR-108–FR-112, US9/AC1–AC11
- [X] T174 [US9] [FLUIG] Fechamento: `fluig-app/README.md` (dois modos de entrada, `VITE_MOCK_LOGIN` e usuários do mock, tela "Usuários", ponteiro para o `criar-admin` no quickstart); revisão de acessibilidade/responsividade das telas novas (`Login`, `TrocaSenha`, `Usuarios`: rótulos, foco visível, contraste AA, 360 px, estilos sob `.jn-app`); `npm run check:css`, `npm run build` e `npm test` verdes; per FR-070, FR-073, Constitution IV/V

### PORTAL

- [X] T175 [P] [PORTAL] Regenerar `portal/src/api/schema.d.ts` (`npm run gen:api`) a partir do contrato 1.2.0 e acrescentar os 8 códigos novos em `MENSAGENS` de `portal/src/api/mensagens.ts` (exigido por `Record<CodigoErro, string>`; o portal nunca recebe esses códigos — comentário como o de `SEM_PERMISSAO`); sem mudança de comportamento; `npm run build` e `npm test` verdes; per Constitution II

### INFRA (final)

- [ ] T176 [INFRA] Executar o roteiro E2E de `specs/001-portal-documentos-terceirizadas/quickstart.md` §6 com as áreas integradas (`VITE_USE_MOCKS=false`), começando sem usuários internos: passos 1 e 39–56 (bootstrap, login, troca obrigatória, cadastro com e-mail, comum sem "Usuários" e com 403, revogação ao desativar/mudar papel/redefinir/sair, bloqueio, regra do último administrador, entrada pelo Fluig) e regressão dos passos 2, 31 e 34–36 com tokens Fluig; conferir no log da API que nenhuma senha provisória aparece fora do adaptador de e-mail de desenvolvimento; registrar divergências para a área responsável; per SC-011, SC-012, SC-013, SC-014, SC-015, SC-016, US8, US9, US10

### Phase 11 — Dependencies & Execution Order

- **Contrato**: pronto (1.2.0). BACKEND+INFRA e FLUIG começam juntos.
- **BACKEND**: T146 → (T147–T155 em paralelo, devem falhar) → T156 → T157 → T158 → T159 → T160 →
  T161 → T162. T159 depende de T157/T158 (repositório e opções); T161 e T162 dependem de T160
  (códigos de erro, sessão) e do e-mail de T161 (T162 usa `ModelosEmail.AcessoUsuarioInterno`).
- **INFRA**: T163 a qualquer momento; T164 depois de T162 (o wrapper chama o comando); T176 depois
  de BACKEND, FLUIG e T175.
- **FLUIG**: T165 → T166 → T167 → (T168, T169) → T170 → T171 → (T172, T173) → T174. Não depende do
  backend (MSW).
- **PORTAL**: T175 independente.
- **Entre áreas**: só o contrato (leitura). Nenhuma tarefa de FLUIG toca `backend/`/`deploy/` e
  nenhuma de BACKEND/INFRA toca `fluig-app/` ou `portal/`.
- **Orquestrador (fora das tarefas)**: antes de `./deploy/publicar.sh`, acrescentar
  `AUTH_LOGIN_LOCAL_SECRET=<openssl rand -base64 48>` ao `producao.env` (fora do git); depois do
  deploy, rodar `jotanunes-docs-criar-admin --login ... --nome ... --email ...` na VPS.

### Phase 11 — Parallel Example

```bash
# Agente BACKEND+INFRA (testes primeiro, juntos)
Task: "UsuarioInternoTests.cs"   Task: "LoginLocalTests.cs"   Task: "SessaoLocalTests.cs"
Task: "RevogacaoLoginLocalTests.cs"   Task: "UsuariosInternosTests.cs"   Task: "PerfilAdminTests.cs (duas origens)"
Task: "EsquemasTests.cs / PerfilClaimTests.cs"   Task: "CriarAdminComandoTests.cs"   Task: "ValidacaoConfiguracaoTests.cs"
Task: ".env.example + README.md (T163)"

# Agente FLUIG (ao mesmo tempo, com MSW)
Task: "schema + tipos + mensagens + api (T165)" → "mocks acesso/usuarios (T166)" → "AuthFluigProvider (T167)"
→ Task: "Login.tsx (T168)"  Task: "TrocaSenha.tsx (T169)"
```
