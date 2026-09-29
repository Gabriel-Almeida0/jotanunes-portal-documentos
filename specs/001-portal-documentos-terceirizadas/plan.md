# Implementation Plan: Portal de Documentação de Terceirizadas Jotanunes

**Branch**: `001-portal-documentos-terceirizadas` (diretório da feature; o trabalho está na branch git `main`) | **Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-portal-documentos-terceirizadas/spec.md`

## Summary

Plataforma com duas interfaces e uma API: a **área Jotanunes** (`fluig-app/`, aberta de dentro do
Fluig, sem login próprio) cadastra obras, empresas, vínculos e tipos de documento, envia convites por
e-mail e analisa os envios; o **portal da terceirizada** (`portal/`, login CNPJ + senha temporária
com troca obrigatória) lista os documentos exigidos, recebe os arquivos e mostra a situação. A
**API** (`backend/`, .NET 8 hexagonal + PostgreSQL 16) expõe dois grupos de rotas com esquemas de
autenticação separados (`fluigAuth` = JWT HS256 emitido pelo Fluig; `portalAuth` = JWT HS256 próprio)
e isola os dados por empresa no servidor. Documentos são exigidos **por empresa** (todos os tipos
ativos), arquivos PDF/JPEG/PNG até 10 MB ficam atrás da porta `IArmazenamentoArquivos` (disco local
em dev) e e-mails saem pelo Resend (ou só no log sem chave). O contrato
[`contracts/openapi.yaml`](contracts/openapi.yaml) é a fonte de verdade para as três áreas.

**Atualização 2026-09-29 (Phase 10)**: (1) **perfis** na área Jotanunes — o token Fluig ganha a
claim opcional `roles`; com `admin` o usuário é administrador, sem ela é comum. As 10 operações de
escrita de cadastros e de análise exigem a política `FluigAdmin` (403 `SEM_PERMISSAO` para comum);
consultas, downloads e convites continuam para todos. `GET /api/fluig/me` devolve `admin` e o
`fluig-app` esconde as ações de administrador. Auditoria ganha `ator_admin` e a ação
`PERMISSAO_NEGADA`. (2) **catálogo padrão** — semeador idempotente na inicialização cria 10 tipos de
documento quando o catálogo está vazio. Contrato 1.1.0; constituição 1.1.0. Decisões em
[research.md](research.md) R15 e R16.

**Atualização 2026-09-29, tarde (Phase 11)**: **login próprio da área Jotanunes** — a Jotanunes ainda
não tem o Fluig. A área Jotanunes ganha login + senha de **usuários internos** (tabela
`usuarios_internos`), com tela **"Usuários"** só para administradores e **primeiro administrador**
criado por um comando da API (`criar-admin`). A entrada pelo Fluig não muda. O token do login próprio
é um JWT HS256 com as **mesmas claims** do Fluig (`sub`, `name`, `email`, `roles`) + `uid`/`ver`/
`troca_senha`, emissor `jotanunes-docs` e segredo próprio; um esquema seletor escolhe a validação
pelo `iss`, então as políticas `Fluig`/`FluigAdmin` e todas as rotas existentes servem aos dois
tokens sem duplicação. Revogação imediata por `versao_credencial` (como o portal). Chave
`Auth:LoginLocal:Habilitado` (padrão `true`) + `GET /api/fluig/auth/configuracao` anônimo para o
front. Contrato **1.2.0**; constituição **1.2.0** (III, IV e V emendados). Decisões em
[research.md](research.md) R17; dados em [data-model.md](data-model.md) §10.

## Technical Context

**Language/Version**: C# 12 / .NET 8 (backend); TypeScript 5 + React 18 (frontends); Node 22 (tooling)

**Primary Dependencies**: ASP.NET Core 8 (Minimal APIs agrupadas por módulo), EF Core 8 +
Npgsql.EntityFrameworkCore.PostgreSQL 8 + EFCore.NamingConventions, Microsoft.AspNetCore.Authentication.JwtBearer 8,
BCrypt.Net-Next 4, Resend via `HttpClient` tipado (sem SDK); Vite 5, react-router-dom 6,
openapi-typescript 7, MSW 2. **Nenhuma biblioteca de CSS/componentes visuais.**

**Storage**: PostgreSQL 16 (dados); disco local/volume para arquivos atrás de `IArmazenamentoArquivos`
(trocável por S3-compatível)

**Testing**: xUnit + WebApplicationFactory + Testcontainers.PostgreSql + FakeTimeProvider (backend);
Vitest + Testing Library + jsdom + MSW (frontends)

**Target Platform**: API em container Linux / servidor .NET; SPAs estáticas em navegador moderno
(Chrome/Edge/Firefox/Safari atuais), `fluig-app` embutido no Fluig (iframe)

**Project Type**: aplicação web — 1 API + 2 SPAs

**Performance Goals**: listas em ≤ 2 s com 500 empresas / 20.000 envios (SC-006); upload de 10 MB
concluído em ≤ 10 s numa conexão de 10 Mbps

**Constraints**: isolamento por empresa verificado por testes; arquivos nunca públicos; segredos só em
variáveis de ambiente; contraste WCAG AA; telas a partir de 360 px; `fluig-app` com estilos escopados
em `.jn-app`

**Scale/Scope**: ~50 obras, ~500 empresas, ~30 tipos de documento, ~20 mil envios/ano; ~10 telas no
`fluig-app`, ~5 no `portal`, 43 operações na API (15 delas só para administrador: 10 desde 1.1.0 +
5 de usuários internos desde 1.2.0; 2 anônimas da área Jotanunes: configuração e login)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Como o plano atende | Status |
|---|---|---|
| I. Hexagonal | 4 projetos (`Domain`, `Application`, `Infrastructure`, `Api`); portas em `Application` para repositórios, e-mail, arquivos, hash, identidade, auditoria, relógio (`TimeProvider`) | ✅ |
| II. Contrato como fonte de verdade | `contracts/openapi.yaml` completo (34 operações, erros com `code`, segurança por rota); fronts geram tipos e mocks dele; teste de contrato no backend | ✅ |
| III. Segurança/LGPD | esquemas da área Jotanunes (`Fluig` + `LoginLocal`, escolhidos pelo seletor `AreaJotanunes`, 1.2.0) e `Portal` separados + testes cruzados; token local revogável por `ver` (1.2.0); filtro por `empresaId` do token; BCrypt 12; token de convite só como hash; download só por endpoint; auditoria; segredos em env; e-mail no log só em Development (exceção explícita da constituição v1.0.1); **(v1.1.0)** operações de administrador com política `FluigAdmin` no servidor, papel vindo só do token Fluig, 403 `SEM_PERMISSAO` sem efeito de negócio (só a tentativa `PERMISSAO_NEGADA` é auditada) | ✅ |
| IV. Testes | xUnit unitário/integração/autorização/contrato; Vitest + Testing Library nos fronts; **(v1.1.0)** teste que percorre todas as rotas de escrita `/api/fluig/*` com token comum (403) e admin (sucesso); **(v1.2.0)** o mesmo teste com token Fluig e token do login próprio, com listas explícitas de rotas anônimas/de sessão | ✅ |
| V. Visual sem framework CSS | CSS puro com tokens `--jn-*` de `docs/design.md`; `.jn-app` no `fluig-app`; ícones SVG inline; **(v1.2.0)** logo só no painel da tela de login do `fluig-app` | ✅ |
| VI. Simplicidade | monolito modular; adaptadores de dev sem credenciais (e-mail no log, disco local, token de dev); `docker compose up` só com Postgres | ✅ |

**Re-check pós-design (Fase 1)**: ✅ sem violações. `data-model.md` não introduz tabelas além das
necessárias; contrato cobre todas as FRs; nenhuma dependência nova fora das listadas.

**Re-check 2026-09-29, tarde (login próprio + usuários internos, constituição 1.2.0)**: ✅ sem
violações, com as emendas da 1.2.0 feitas **antes** deste plano (Sync Impact Report da constituição).
I: novas portas `IUsuarioInternoRepositorio` e `IEmissorTokenJotanunes` na `Application`, adaptadores
na `Infrastructure`, esquemas/seletor/políticas só na `Api`; o comando `criar-admin` chama um caso de
uso. II: contrato 1.2.0 atualizado antes da implementação (rotas, schemas, 8 códigos novos,
`x-requer-admin` nas 5 rotas de usuários). III: token local com segredo/emissor próprios e revogação
por `ver` (regra nova da 1.2.0); BCrypt 12; bloqueio e anti-enumeração iguais ao portal; senha
provisória nunca na tela nem no log (única exceção: stdout do `criar-admin`, prevista na 1.2.0); papel
do cadastro, conferido a cada requisição; 403 `SEM_PERMISSAO` antes de qualquer efeito, com auditoria.
IV: `PerfilAdminTests` passa a rodar com as duas origens de identidade e classifica rotas anônimas e
de sessão em listas explícitas (regra da 1.2.0); testes de revogação, anti-enumeração, bootstrap e
Fluig inalterado. V: tela de login com logo no painel (exceção da 1.2.0), resto sem cabeçalho de
marca, CSS próprio. VI: nenhuma dependência nova (JwtBearer, BCrypt e Resend já existem); tabela única
nova; o comando reaproveita a composição da API.

**Re-check 2026-09-29 (perfis + catálogo padrão, constituição 1.1.0)**: ✅ sem violações. Nenhuma
tabela nova (só a coluna `auditoria.ator_admin`); nenhuma dependência nova; o papel continua atrás da
porta `IUsuarioFluigAtual` (I); contrato atualizado antes da implementação, com `x-requer-admin` e
`SEM_PERMISSAO` (II); autorização no servidor com testes negativos por rota (III, IV); o aviso de
perfil no `fluig-app` usa só CSS próprio e texto (V); semeador sem infraestrutura nova (VI).

## Project Structure

### Documentation (this feature)

```text
specs/001-portal-documentos-terceirizadas/
├── spec.md              # Especificação + Clarifications
├── plan.md              # Este arquivo
├── research.md          # Fase 0: decisões técnicas
├── data-model.md        # Fase 1: entidades, regras, estados
├── quickstart.md        # Fase 1: como rodar + roteiro E2E
├── contracts/
│   ├── openapi.yaml     # Contrato da API (fonte de verdade)
│   └── fluig-identity.md# Contrato do token Fluig
├── checklists/
│   └── requirements.md  # Qualidade da spec
└── tasks.md             # Fase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
compose.yaml                     # [INFRA] Postgres 16 (+ volume)
.env.example                     # [INFRA] nomes das variáveis (sem valores secretos)
scripts/
└── gerar-token-fluig-dev.mjs    # [INFRA] token Fluig de desenvolvimento
docs/                            # [INFRA] design.md, design-referencias/, transcricao.txt, áudio
README.md                        # [INFRA] visão geral + link para o quickstart

backend/                         # [BACKEND]
├── Jotanunes.Docs.sln
├── Directory.Build.props        # net8.0, nullable, warnings as errors
├── src/
│   ├── Jotanunes.Docs.Domain/
│   │   ├── Comum/               # Entidade base, ErroDominio, Resultado
│   │   ├── Obras/               # Obra, Uf
│   │   ├── Empresas/            # Empresa, Cnpj (VO), SituacaoAcesso, PoliticaSenha
│   │   ├── Convites/            # Convite, SituacaoConvite
│   │   ├── TiposDocumento/      # TipoDocumento
│   │   ├── Envios/              # EnvioDocumento, StatusEnvio, SituacaoDocumento, FormatoArquivo
│   │   └── UsuariosInternos/    # UsuarioInterno, SituacaoUsuarioInterno, LoginUsuario (VO) — R17
│   ├── Jotanunes.Docs.Application/
│   │   ├── Portas/              # IRepositórios, IEnviadorEmail, IArmazenamentoArquivos,
│   │   │                        # IHasherSenha, IGeradorSegredos, IUsuarioFluigAtual (+EhAdmin),
│   │   │                        # IEmpresaPortalAtual, IEmissorTokenPortal, IRegistroAuditoria,
│   │   │                        # IContextoRequisicao, IUnidadeTrabalho, IBloqueioExclusivo,
│   │   │                        # IUsuarioInternoRepositorio, IEmissorTokenJotanunes (R17)
│   │   ├── Obras/ Empresas/ Convites/ TiposDocumento/ Envios/ Portal/ Painel/  # casos de uso + DTOs
│   │   ├── AcessoJotanunes/     # LoginJotanunes, TrocarSenhaJotanunes, SairJotanunes (R17)
│   │   ├── UsuariosInternos/    # Listar/Obter/Criar/Atualizar/RedefinirSenha, CriarAdministradorInicial
│   │   │                        # TiposDocumento/CatalogoTiposPadrao.cs + SemearCatalogoTiposPadrao (R15)
│   │   ├── Emails/              # ModelosEmail (convite, rejeição)
│   │   └── Erros/               # ErroAplicacao com CodigoErro
│   ├── Jotanunes.Docs.Infrastructure/
│   │   ├── Persistencia/        # DocsDbContext, configurações, repositórios, Migrations/
│   │   ├── Email/               # ResendEnviadorEmail, LogEnviadorEmail
│   │   ├── Armazenamento/       # ArmazenamentoDiscoLocal, DetectorFormato
│   │   ├── Seguranca/           # BCryptHasherSenha, GeradorSegredos, EmissorTokenPortal,
│   │   │                        # EmissorTokenJotanunes (+ OpcoesLoginLocal)
│   │   └── Auditoria/
│   └── Jotanunes.Docs.Api/
│       ├── Program.cs           # composição, CORS, rate limit, ProblemDetails
│       ├── Autenticacao/        # esquemas Fluig, LoginLocal e Portal + seletor AreaJotanunes; políticas
│       │                        # (Fluig, FluigSessao, FluigAdmin, Portal, PortalCompleto),
│       │                        # PapelAdminRequirement, SenhaLocalDefinidaRequirement, adaptadores
│       ├── Comandos/            # ComandoCriarAdmin (criar-admin, stdout/stderr, código de saída)
│       ├── Endpoints/Fluig/     # grupos /api/fluig/* (+ AcessoJotanunesEndpoints, UsuariosInternosEndpoints)
│       ├── Endpoints/Portal/    # grupos /api/portal/*
│       └── appsettings*.json    # sem segredos
└── tests/
    ├── Jotanunes.Docs.Domain.Tests/
    ├── Jotanunes.Docs.Application.Tests/
    └── Jotanunes.Docs.Api.Tests/       # integração (Testcontainers), autorização, contrato

fluig-app/                       # [FLUIG] React + Vite + TS, HashRouter, estilos sob .jn-app
├── index.html  package.json  vite.config.ts  tsconfig.json  .env.example
└── src/
    ├── main.tsx  App.tsx
    ├── api/                     # schema.d.ts (gerado), client.ts, hooks por recurso
    ├── auth/                    # leitura do token (fragmento/sessionStorage/dev), guarda,
    │                            # useEhAdmin + SomenteAdmin/AvisoSomenteAdmin (perfil, R16),
    │                            # useSessao (origem, entrar, sair) — R17
    ├── assets/                  # logo-jotanunes.png (só na tela de login, R17)
    ├── mocks/                   # handlers MSW conforme contrato + browser.ts/server.ts
    ├── styles/                  # tokens.css, base.css
    ├── components/              # Botao, Campo, Tabela, Selo, TituloPagina, Modal, Paginacao, icons/
    ├── pages/                   # Painel, Obras, ObraDetalhe, Empresas, EmpresaDetalhe,
    │                            # TiposDocumento, FilaAnalise, EnvioAnalise, AcessoNegado,
    │                            # Login, TrocaSenha, Usuarios (R17)
    └── test/                    # setup.ts
    (testes *.test.tsx ao lado dos componentes/páginas)

portal/                          # [PORTAL] React + Vite + TS, BrowserRouter
├── index.html  package.json  vite.config.ts  tsconfig.json  .env.example
└── src/
    ├── main.tsx  App.tsx
    ├── api/  auth/  mocks/  styles/  components/  test/
    └── pages/                   # Acesso (login), TrocaSenha, MeusDocumentos, DocumentoHistorico
```

**Structure Decision**: aplicação web com três áreas independentes na raiz (`backend/`, `fluig-app/`,
`portal/`) + arquivos de infraestrutura na raiz. Cada área tem seu próprio build, testes e
dependências; o único artefato compartilhado é o contrato em
`specs/001-portal-documentos-terceirizadas/contracts/openapi.yaml`, que os fronts **leem** (geração
de tipos) mas não editam. Os tokens CSS são **copiados** para cada front (`src/styles/tokens.css`) a
partir de `docs/design.md` §10, para que nenhuma área precise editar arquivos de outra.

## Design de alto nível

### Backend (hexagonal)

- **Domain**: entidades com invariantes — `Empresa.RegistrarConvite(...)`, `Empresa.TrocarSenha(...)`,
  `Empresa.RegistrarFalhaLogin(agora)`, `EnvioDocumento.Aprovar(autor, agora)`,
  `EnvioDocumento.Rejeitar(autor, motivo, agora)`; value objects `Cnpj`, `Email`; regras de
  situação derivada (`SituacaoDocumento.De(envios)`, `SituacaoAcesso.De(empresa, ultimoConvite, agora)`).
- **Application**: um caso de uso por operação do contrato (ex.: `EnviarConvite`, `EnviarDocumento`,
  `RejeitarEnvio`, `LoginPortal`), recebendo portas por DI. Erros de negócio viram
  `ErroAplicacao(CodigoErro)`, mapeados para ProblemDetails na `Api`.
- **Infrastructure**: EF Core (consultas de leitura com projeções para os DTOs de lista; índice parcial
  e `ExecuteUpdateAsync` condicional para concorrência), adaptadores de e-mail, arquivos e segurança.
- **Api**: Minimal APIs em `MapGroup("/api/fluig").RequireAuthorization("Fluig")` e
  `MapGroup("/api/portal")` com políticas `Portal` / `PortalCompleto`; `IEmpresaPortalAtual` lido do
  token — os casos de uso do portal **nunca** recebem `empresaId` do cliente.

### Autenticação

| Grupo | Esquema | Política | Observação |
|---|---|---|---|
| `/api/fluig/*` (consultas, downloads, convites) | `Fluig` (JwtBearer HS256, segredo Fluig) | `Fluig` | identidade → `IUsuarioFluigAtual` (`EhAdmin` da claim `roles`) |
| `/api/fluig/*` com `x-requer-admin: true` (10 operações) | `Fluig` | `Fluig` + `FluigAdmin` | requisito `PapelAdminRequirement`; falha → 403 `SEM_PERMISSAO` + auditoria `PERMISSAO_NEGADA` |
| `/api/portal/auth/login`, `/api/portal/convites/validar` | — | anônimo + rate limit | |
| `/api/portal/me`, `/api/portal/auth/trocar-senha` | `Portal` | `Portal` | aceita `troca_senha=true` |
| demais `/api/portal/*` | `Portal` | `PortalCompleto` | exige `troca_senha=false` |

`OnTokenValidated` do esquema `Portal` confere `ver` e `ativa` no banco (revogação imediata).

**Desde a Phase 11 (R17)** a área Jotanunes tem dois esquemas atrás do seletor `AreaJotanunes`
(`AddPolicyScheme` + `ForwardDefaultSelector` pelo `iss` do Bearer):

| Grupo / rota | Esquema efetivo | Política | Observação |
|---|---|---|---|
| `GET /api/fluig/auth/configuracao` | — | anônimo | sempre 200 `{loginLocalHabilitado}` |
| `POST /api/fluig/auth/login` | — | anônimo + rate limit (política anônima existente) | 404 se o login próprio estiver desligado |
| `GET /api/fluig/me`, `POST /api/fluig/auth/trocar-senha`, `POST /api/fluig/auth/sair` | `AreaJotanunes` → `Fluig` ou `LoginLocal` | `FluigSessao` (segundo `MapGroup("/api/fluig")`) | aceita troca de senha pendente |
| demais `/api/fluig/*` | `AreaJotanunes` | `Fluig` (+ `SenhaLocalDefinidaRequirement`) | troca pendente → 403 `TROCA_SENHA_OBRIGATORIA` |
| `/api/fluig/*` com `x-requer-admin` (15, inclui `/api/fluig/usuarios*`) | `AreaJotanunes` | `Fluig` + `FluigAdmin` | mesmo `PapelAdminRequirement` para os dois tokens |

`OnTokenValidated` do esquema `LoginLocal` confere `uid`, `ver`, `ativo` e `login = sub` no banco
(revogação imediata). O seletor só manda para `LoginLocal` quando `iss = jotanunes-docs` **e**
`Auth:LoginLocal:Habilitado = true`. `IUsuarioFluigAtual` ganha `EhLoginLocal`/`UsuarioInternoId`;
`ResultadoAutorizacaoHandler`: falha de `SenhaLocalDefinidaRequirement` tem precedência →
`TROCA_SENHA_OBRIGATORIA` (sem `PERMISSAO_NEGADA`); falha só de `PapelAdminRequirement` →
`SEM_PERMISSAO` + auditoria (como hoje).

### Login próprio e usuários internos (R17)

- **Casos de uso** (`Application/AcessoJotanunes`, `Application/UsuariosInternos`): `LoginJotanunes`
  (mesma ordem e regras do `LoginPortal`, `tentativas_login` com chave de login), `TrocarSenhaJotanunes`,
  `SairJotanunes`, `ObterConfiguracaoAcesso`, `ListarUsuariosInternos`, `ObterUsuarioInterno`,
  `CriarUsuarioInterno` e `RedefinirSenhaUsuarioInterno` (gravar → e-mail → commit; falha →
  `EMAIL_ACESSO_FALHOU`), `AtualizarUsuarioInterno` (sob `IBloqueioExclusivo`: próprio →
  `ALTERACAO_PROPRIA_NAO_PERMITIDA`; zero admins → `ULTIMO_ADMINISTRADOR`) e
  `CriarAdministradorInicial` (comando). E-mail: `ModelosEmail.AcessoUsuarioInterno`.
- **Comando `criar-admin`**: em `Program.cs`, depois de `builder.Build()` e da validação de
  configuração/migrations, `if (args is ["criar-admin", ..])` → `ComandoCriarAdmin.ExecutarAsync(app.Services,
  args, Console.Out, Console.Error)` e `return codigo;` (não chama `RunAsync`). Escrita só em
  `TextWriter` (testável), nunca `ILogger`.
- **Auditoria**: `RegistroAuditoriaEf` grava `LOCAL` quando `IUsuarioFluigAtual.EhLoginLocal` e o caso
  de uso passou `FLUIG`; `SISTEMA` no comando; ações novas em data-model §7.

O `ResultadoAutorizacaoHandler` passa a olhar o requisito que falhou: `PapelAdminRequirement` →
`SEM_PERMISSAO`; `TrocaSenhaConcluidaRequirement` → `TROCA_SENHA_OBRIGATORIA` (hoje todo 403 vira
`TROCA_SENHA_OBRIGATORIA`). O papel **não** é revogado no meio do token (vale até expirar, R16).

### Catálogo padrão (R15)

`Program.cs`, depois das migrations: se `Catalogo:SemearTiposPadrao` (padrão `true`), executa
`SemearCatalogoTiposPadrao` num escopo de DI — sob `pg_advisory_xact_lock`, cria os 10 tipos de
`data-model.md` §4.1 **só se** `tipos_documento` estiver vazia. `ApiFactory` dos testes desliga por
padrão.

### Frontends

- Cliente HTTP único por app (`src/api/client.ts`): injeta `Authorization`, converte
  `application/problem+json` em erro tipado com `code`, trata 401 (fluig-app → tela "Abra pelo
  Fluig" na sessão do Fluig ou tela de login na sessão de login próprio, R17; portal → volta ao login) e 403 `TROCA_SENHA_OBRIGATORIA` (portal → tela de troca).
- Componentes próprios pequenos (botão primário/secundário, campo com rótulo, selo de situação com
  texto, tabela, paginação, modal de confirmação, título com barra vermelha 50×6 px).
- `fluig-app`: sem cabeçalho de marca; navegação lateral clara com item ativo em `#BD1E1B` + barra
  de 3 px; tabelas densas; filtros no padrão "Encontre seu Jota".
- `portal`: cabeçalho `#F2F2F2` com logo, razão social e "Sair"; painel de login com
  `radius-signature`; cards grandes por documento; upload por botão (input file) com validação de
  formato/tamanho no cliente antes de enviar (a validação do servidor continua valendo).
- **Login próprio no `fluig-app` (R17)**: `AuthFluigProvider` ganha os estados `login` (tela
  `Login`), `trocaSenha` (tela `TrocaSenha`, bloqueia o app) e guarda `origem`; sem token consulta
  `GET /api/fluig/auth/configuracao`; 401 com origem `LOGIN_LOCAL` volta ao login com "Sua sessão
  expirou. Entre de novo.". Menu: "Usuários" só para administrador; "Trocar senha" e "Sair" só para
  `LOGIN_LOCAL`. Página `Usuarios` (tabela + modais, própria linha sem "Desativar"/troca de papel).
  Token continua em memória + `sessionStorage['jn.fluigToken']` (R17). Mocks com `VITE_MOCK_LOGIN`.
- **Perfil no `fluig-app` (2026-09-29)**: `AuthFluigProvider` guarda `admin` de `/api/fluig/me`;
  `useEhAdmin()` e `<SomenteAdmin>` escondem botões e formulários de administrador; `<AvisoSomenteAdmin>`
  mostra uma vez por tela "Só administradores podem cadastrar, alterar ou analisar. Se você precisa,
  fale com a TI."; formulários de obra/empresa viram exibição em modo leitura; o cliente trata 403
  `SEM_PERMISSAO` como erro exibível (sem sair do sistema). Menu igual para os dois perfis.

### Configuração (variáveis de ambiente)

| Variável | Onde | Exemplo dev |
|---|---|---|
| `ConnectionStrings__Default` | API | `Host=localhost;Port=5432;Database=jotanunes_docs;Username=jotanunes;Password=jotanunes` |
| `Auth__Fluig__Secret` / `__Issuer` / `__Audience` | API | valor de `FLUIG_JWT_SECRET` / `fluig` / `jotanunes-docs-api` |
| `Auth__Portal__Secret` | API | 32+ bytes aleatórios |
| `Resend__ApiKey` / `Resend__From` | API | vazio em dev (e-mail vai para o log) |
| `Portal__BaseUrl` | API | `http://localhost:5174` |
| `Storage__Root` | API | `../../.data/uploads` (relativo à raiz de conteúdo `backend/src/Jotanunes.Docs.Api` → `backend/.data/uploads`) |
| `Cors__Origins` | API | `http://localhost:5173,http://localhost:5174` |
| `Database__MigrateOnStartup` | API | `true` |
| `Catalogo__SemearTiposPadrao` | API | `true` (testes: `false`, exceto os do catálogo) |
| `Auth__LoginLocal__Habilitado` | API | `true` (padrão); `false` desliga o login próprio (R17) |
| `Auth__LoginLocal__Secret` | API | valor de `AUTH_LOGIN_LOCAL_SECRET` (32+ bytes, diferente dos outros dois) |
| `FluigApp__BaseUrl` | API | `http://localhost:5173` (link dos e-mails de acesso) |
| `AUTH_LOGIN_LOCAL_SECRET` | `.env` raiz / `producao.env` | 32+ bytes aleatórios |
| `VITE_MOCK_LOGIN` | fluig-app | `true` = mocks começam sem token (tela de login) |
| `FLUIG_JWT_SECRET` | `.env` raiz (script de token) | 32+ bytes aleatórios |
| `VITE_API_URL` | fronts | `http://localhost:5080` |
| `VITE_USE_MOCKS` | fronts | `false` (ou `true` sem backend) |
| `VITE_FLUIG_DEV_TOKEN` | fluig-app | saída do script |

## Paralelização (3 agentes)

- **Pré-requisito comum**: `contracts/openapi.yaml` (pronto nesta fase) e `docs/design.md`.
- **BACKEND** avança sozinho com Testcontainers; **FLUIG** e **PORTAL** avançam com MSW a partir do
  contrato e trocam `VITE_USE_MOCKS=false` quando a API estiver no ar.
- **INFRA** (compose, `.env.example`, script de token, README) é pequena e deve ser feita primeiro
  pelo orquestrador; nenhuma área depende dela para testes automatizados.
- Integração final: roteiro E2E do [quickstart.md](quickstart.md).
- **Phase 10 (2 agentes)**: agente **BACKEND+INFRA** (`backend/`, `scripts/`) e agente **FLUIG**
  (`fluig-app/`), em paralelo a partir do contrato 1.1.0 já atualizado; o `portal/` só regenera
  tipos (sem mudança de comportamento).
- **Phase 11 (2 agentes)**: agente **BACKEND+INFRA** (`backend/`, `scripts/`, `deploy/`, `README.md`,
  `.env.example`) e agente **FLUIG** (`fluig-app/`), em paralelo a partir do contrato 1.2.0 já
  atualizado; o `portal/` só regenera tipos e acrescenta os códigos novos ao mapa de mensagens
  (orquestrador). **Antes de publicar**: o orquestrador acrescenta `AUTH_LOGIN_LOCAL_SECRET` ao
  `producao.env` (fora do git) e, depois do deploy, roda `jotanunes-docs-criar-admin` na VPS.

## Complexity Tracking

Sem violações da constituição a justificar.
