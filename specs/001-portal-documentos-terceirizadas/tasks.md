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
- **[Story]**: US1…US5 (só nas fases de user story)
- **[ÁREA]** (obrigatória em TODA tarefa): `[BACKEND]` só edita `backend/`; `[FLUIG]` só edita
  `fluig-app/`; `[PORTAL]` só edita `portal/`; `[INFRA]` só edita arquivos da raiz
  (`compose.yaml`, `.env.example`, `.gitignore`, `README.md`, `scripts/`, `docs/`).
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
  (documentos por empresa).
