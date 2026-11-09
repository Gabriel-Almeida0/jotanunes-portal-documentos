---

description: "Lista de tarefas — 002 Documentos por obra"
---

# Tasks: Documentos por obra

**Input**: Design documents from `/specs/002-documentos-por-obra/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/mudancas-api.md, quickstart.md.
Contrato: `specs/001-portal-documentos-terceirizadas/contracts/openapi.yaml` **1.3.0** (já atualizado, 52 operações).

**Tests**: INCLUÍDOS (constituição, princípio IV): xUnit + Testcontainers no backend; Vitest + Testing Library + MSW
nos fronts. Escreva o teste antes e veja falhar.

## Format: `[ID] [P?] [Story] [ÁREA] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência de tarefa incompleta)
- **[Story]**: US1…US5 da [spec](spec.md)
- **[ÁREA]**: `[BACKEND]` só edita `backend/`; `[FLUIG]` só `fluig-app/`; `[PORTAL]` só `portal/`; `[DOCS]` só
  `specs/`, `README.md`, `docs/`. Nenhuma tarefa edita pasta de outra área.

## Regras para os agentes

1. **Fonte de verdade**: o `openapi.yaml` 1.3.0 e [`contracts/mudancas-api.md`](contracts/mudancas-api.md). Nenhum
   agente edita o contrato; divergência → parar e reportar.
2. **FLUIG/PORTAL** trabalham contra MSW (respostas seguem o contrato); não esperam o backend.
3. **BACKEND** valida com Testcontainers (Docker ligado).
4. Visual: `docs/design.md` (tokens `--jn-*`, status com texto, WCAG AA, forma `20px 0`); proibido framework de CSS.
5. Textos ao usuário em português, tom de `docs/design.md` §9; erros pelos `title` de `CodigoErro`.
6. Commits: não commitar; o orquestrador revisa e commita.

---

## Phase 1: Setup

- [X] T001 [P] [FLUIG] Rodar `npm run gen:api` em `fluig-app/` para regenerar `fluig-app/src/api/schema.d.ts` a partir do contrato 1.3.0 e adicionar os aliases novos em `fluig-app/src/api/tipos.ts` (`Abrangencia`, `TipoExigidoObra`, `VinculoEncerrado`, `ObraNaEmpresa`); corrigir os erros de tipo que surgirem só com ajustes mínimos (ex.: `documentos` → `documentosObra` em `EmpresaNaObra`), sem mudar comportamento ainda
- [X] T002 [P] [PORTAL] Rodar `npm run gen:api` em `portal/` para regenerar `portal/src/api/schema.d.ts` e adicionar em `portal/src/api/tipos.ts` os aliases `ObraPortal`, `Abrangencia`; `npm run build` sem erros de tipo

---

## Phase 2: Foundational (bloqueia todas as histórias)

### BACKEND — modelo e migration

- [X] T003 [BACKEND] Criar `Abrangencia` (`Geral`, `PorObra`; persistido como `GERAL`/`POR_OBRA`) em `backend/src/Jotanunes.Docs.Domain/TiposDocumento/Abrangencia.cs`; em `TipoDocumento.cs` adicionar `Abrangencia` ("not null default `GERAL`"), parâmetro em `Criar` e método `TrocarAbrangencia(nova, temEnvios)` que lança erro de domínio `ABRANGENCIA_IMUTAVEL` quando `temEnvios` e a abrangência muda; atualizar o comentário da linha 5 ("todo tipo GERAL ativo é exigido de toda empresa ativa")
- [X] T004 [P] [BACKEND] Em `backend/src/Jotanunes.Docs.Domain/Obras/ObraEmpresa.cs` adicionar `Ativo` (default `true`), `EncerradoEm`, `EncerradoPorLogin` e métodos `Encerrar(autor, agora)` (retorna `false` se já encerrado) e `Reabrir(autor, agora)` (ativo, limpa `Encerrado*`, atualiza `VinculadoEm/Por`; retorna `false` se já ativo)
- [X] T005 [P] [BACKEND] Criar `backend/src/Jotanunes.Docs.Domain/Obras/ObraTipoDocumento.cs` (`ObraId`, `TipoDocumentoId`, `MarcadoEm`, `MarcadoPorLogin`)
- [X] T006 [BACKEND] Em `backend/src/Jotanunes.Docs.Domain/Envios/EnvioDocumento.cs` adicionar `ObraId` (`Guid?`); `Criar` recebe `abrangencia` e `obraId` e garante "nulo ⇔ tipo `GERAL`" (erro de domínio se inconsistente); chave de armazenamento não muda
- [X] T007 [P] [BACKEND] Adicionar ações `TIPO_ABRANGENCIA_ALTERADA`, `OBRA_TIPO_MARCADO`, `OBRA_TIPO_DESMARCADO`, `VINCULO_ENCERRADO`, `VINCULO_REABERTO` e recurso `VINCULO` em `backend/src/Jotanunes.Docs.Domain/Auditoria/RegistroAuditoria.cs`; adicionar códigos `ABRANGENCIA_IMUTAVEL` (409) e `TIPO_NAO_E_POR_OBRA` (400) onde os códigos de erro da Application/Api são mapeados
- [X] T008 [P] [BACKEND] Testes de domínio em `backend/tests/Jotanunes.Docs.Domain.Tests/` (`TipoDocumentoAbrangenciaTests`, `ObraEmpresaVinculoTests`, casos novos em `EnvioDocumentoTests`): troca de abrangência com/sem envios, encerrar/reabrir idempotentes, envio geral com obra e por obra sem obra recusados
- [X] T009 [BACKEND] Mapear em `backend/src/Jotanunes.Docs.Infrastructure/Persistencia/DocsDbContext.cs`: `tipos_documento.abrangencia varchar(10)` com check (`GERAL`|`POR_OBRA`) e default `'GERAL'`; tabela `obra_tipos_documento` (PK `(obra_id, tipo_documento_id)`, FKs Restrict, índice `tipo_documento_id`); `obra_empresas.ativo bool not null default true`, `encerrado_em timestamptz null`, `encerrado_por_login varchar(100) null`, índice `(empresa_id) WHERE ativo`; `envios_documento.obra_id uuid null` FK Restrict; índice `ix_envios_documento_vivo` recriado em `(empresa_id, tipo_documento_id, obra_id)` com `AreNullsDistinct(false)` e filtro `status <> 'REJEITADO'`; índice `(obra_id, empresa_id, tipo_documento_id, enviado_em desc) WHERE obra_id is not null`
- [X] T010 [BACKEND] Gerar a migration `DocumentosPorObra` em `backend/src/Jotanunes.Docs.Infrastructure/Persistencia/Migrations/` (`dotnet ef migrations add DocumentosPorObra`); conferir que o SQL gerado usa `NULLS NOT DISTINCT`, que tipos existentes ficam `GERAL` e envios existentes ficam com `obra_id` nulo (FR-201), e que `Down` reverte
- [X] T011 [BACKEND] Estender as portas em `backend/src/Jotanunes.Docs.Application/Portas/Persistencia.cs`: `IObraRepositorio` (tipos exigidos: listar/marcar/desmarcar; vínculo encerrado; listar empresas/obras só com vínculo ativo; listar vínculos encerrados com contagem de envios), `IEnvioRepositorio` (`ExisteVivoAsync`, histórico e listas com `obraId`), `ITipoDocumentoRepositorio` (`TemEnviosAsync`), `IConsultaDocumentos.ContarPorObraAsync(obraId, empresaIds)`; implementar em `backend/src/Jotanunes.Docs.Infrastructure/Persistencia/Repositorios/Repositorios.cs` e `Consultas/ConsultaDocumentosEf.cs` (data-model §5; contagem geral só tipos `GERAL`; pendência inclui por obra conforme "Exigido (da obra)")
- [X] T012 [BACKEND] Atualizar `backend/tests/Jotanunes.Docs.Api.Tests/Infra/Semente.cs` com ajudantes para tipo `POR_OBRA`, marcação em obra e envio por obra, e corrigir testes existentes quebrados pela mudança de esquema (rodar `dotnet test --filter "Categoria!=Desempenho"`)

### FLUIG / PORTAL — mocks

- [X] T013 [P] [FLUIG] Remodelar `fluig-app/src/mocks/dados.ts`: tipos com `abrangencia` (semente: os 10 atuais `GERAL` + 2 `POR_OBRA`, ex.: "ART da obra", "Ordem de serviço"), `obraTipos` (marcações), vínculos com `ativo/encerradoEm`, envios com `obraId`; funções `situacaoDocumento`/`contagemDocumentos`/`temPendencia` por geral e por obra seguindo data-model §5
- [X] T014 [P] [PORTAL] Remodelar `portal/src/mocks/dados.ts`: obras, vínculos ativos/encerrados, tipos com `abrangencia`, marcações por obra, envios com `obraId`; `documentosGerais(empresaId)` e `documentosDaObra(empresaId, obraId)`

**Checkpoint**: esquema migrado, portas prontas, mocks com o modelo novo.

---

## Phase 3: User Story 1 — Abrangência e documentos exigidos por obra (P1) 🎯 MVP

**Goal**: administrador define a abrangência dos tipos e marca os tipos exigidos de cada obra.

**Independent Test**: criar "ART da obra" (*Por obra*), marcá-lo na obra A e não na B; a lista de exigidos da A
mostra o tipo; a da B não (spec US1).

### Tests

- [X] T015 [P] [US1] [BACKEND] Testes de integração em `backend/tests/Jotanunes.Docs.Api.Tests/Fluig/TiposAbrangenciaTests.cs`: criar com `abrangencia` obrigatória (400 sem ela), filtro `?abrangencia=`, troca com envio → 409 `ABRANGENCIA_IMUTAVEL`, `POR_OBRA → GERAL` sem envios remove marcações, catálogo padrão nasce `GERAL`
- [X] T016 [P] [US1] [BACKEND] Testes em `backend/tests/Jotanunes.Docs.Api.Tests/Fluig/TiposExigidosObraTests.cs`: `GET /obras/{o}/tipos-documento` (só `POR_OBRA` ativos + inativos marcados, ordem por nome, `exigido`/`marcadoEm`), `PUT` idempotente, `PUT` com tipo `GERAL` → 400 `TIPO_NAO_E_POR_OBRA`, `DELETE` idempotente, 404 obra/tipo inexistentes, auditoria `OBRA_TIPO_MARCADO/DESMARCADO` só quando muda
- [X] T017 [US1] [BACKEND] Incluir `fluigMarcarTipoExigidoObra` e `fluigDesmarcarTipoExigidoObra` em `ExigemAdmin` de `backend/tests/Jotanunes.Docs.Api.Tests/Autorizacao/PerfilAdminTests.cs` e atualizar `Contrato_tem_43_operacoes` para 52 em `backend/tests/Jotanunes.Docs.Api.Tests/Contrato/ContratoOpenApiTests.cs`
- [X] T018 [P] [US1] [FLUIG] Testes em `fluig-app/src/pages/TiposDocumento.test.tsx` (abrangência obrigatória no formulário, coluna/filtro de abrangência, erro 409 com mensagem) e `fluig-app/src/pages/obra/AbaDocumentosExigidos.test.tsx` (marcar/desmarcar, aviso sobre gerais, modo leitura para comum)

### Implementation

- [X] T019 [US1] [BACKEND] Abrangência em `backend/src/Jotanunes.Docs.Application/TiposDocumento/CasosDeUsoTipos.cs` (`CriarTipo`, `AtualizarTipo` com `TemEnviosAsync` e remoção de marcações, `ListarTipos` com filtro, `SemearCatalogoTiposPadrao` com `GERAL`), DTOs em `Application/Dtos/Dtos.cs` e auditoria `TIPO_ABRANGENCIA_ALTERADA`
- [X] T020 [US1] [BACKEND] Casos de uso `ListarTiposExigidosObra`, `MarcarTipoExigidoObra`, `DesmarcarTipoExigidoObra` em `backend/src/Jotanunes.Docs.Application/Obras/CasosDeUsoObras.cs`; `quantidadeTiposExigidos` em `ObterObra`/`ListarObras`
- [X] T021 [US1] [BACKEND] Rotas em `backend/src/Jotanunes.Docs.Api/Endpoints/Fluig/ObrasEndpoints.cs` (`GET/PUT/DELETE /obras/{obraId}/tipos-documento[/{tipoDocumentoId}]`, `.WithName` = operationId do contrato, política admin nas escritas) e filtro `abrangencia` em `Fluig/TiposDocumentoEndpoints.cs`
- [X] T022 [P] [US1] [FLUIG] Handlers MSW em `fluig-app/src/mocks/handlers/tipos.ts` (abrangência, 409) e `fluig-app/src/mocks/handlers/obras.ts` (tipos exigidos GET/PUT/DELETE, 403 para comum)
- [X] T023 [US1] [FLUIG] `fluig-app/src/pages/TiposDocumento.tsx`: campo obrigatório "Abrangência" (rádio: "Geral da empresa — enviado uma vez, vale em todas as obras" / "Por obra — cada obra escolhe se exige"), coluna com selo de texto, filtro por abrangência, textos da linha 63 e do modal de alternância ajustados por abrangência; tratar `ABRANGENCIA_IMUTAVEL`
- [X] T024 [P] [US1] [FLUIG] Criar `fluig-app/src/components/Abas.tsx` + `Abas.css` (padrão WAI-ARIA tabs: `role=tablist/tab/tabpanel`, setas ←/→, foco visível, tokens `--jn-*`) e estilos de `<details>` recolhível em `fluig-app/src/styles/paginas.css`
- [X] T025 [US1] [FLUIG] Reorganizar `fluig-app/src/pages/ObraDetalhe.tsx` em abas "Empresas" | "Documentos exigidos" | "Vínculos encerrados" (aba guardada em `?aba=`); extrair `fluig-app/src/pages/obra/AbaDocumentosExigidos.tsx` (lista de tipos `POR_OBRA` com caixa de seleção, salvando cada mudança; `SomenteAdmin` para editar; nota "Também são exigidos os documentos gerais da empresa"; estado vazio com link para cadastrar tipo por obra)

**Checkpoint**: US1 testável sozinha (área Jotanunes + API).

---

## Phase 4: User Story 2 — Empresa envia documentos de cada obra pelo portal (P1)

**Goal**: portal com resumo (gerais + um cartão por obra) e página por obra com envio/histórico.

**Independent Test**: empresa nas obras A e B com "ART da obra" exigido nas duas; enviar na A → "Em análise" só na A
(spec US2).

### Tests

- [X] T026 [P] [US2] [BACKEND] Testes em `backend/tests/Jotanunes.Docs.Api.Tests/Portal/DocumentosObraTests.cs`: `GET /portal/obras` (só ativas com vínculo ativo, contagem, ordem pendência→nome), listar/histórico/enviar por obra, independência entre obras, duas abas mesmo documento → 1 aceito, mesma empresa obras diferentes → ambos aceitos, `/portal/documentos` só gerais, tipo `POR_OBRA` na rota geral → 404 e `GERAL` na rota de obra → 404
- [X] T027 [P] [US2] [BACKEND] Testes negativos de isolamento em `backend/tests/Jotanunes.Docs.Api.Tests/Portal/IsolamentoObraTests.cs`: obra de outra empresa, vínculo encerrado, obra inativa, tipo não marcado → 404 em todas as rotas de obra; download de envio por obra com vínculo encerrado → 404; token Fluig nas rotas novas do portal → 401
- [X] T028 [P] [US2] [PORTAL] Testes em `portal/src/pages/Resumo.test.tsx` (cartões, ordem, estados vazios "Você ainda não está em nenhuma obra…"), `portal/src/pages/DocumentosObra.test.tsx` (lista, envio muda só a obra, rejeitado + reenviar, "Tudo certo nesta obra.", nome da obra visível) e ajustar `MeusDocumentos*.test.tsx`, `Acesso.test.tsx`, `TrocaSenha.test.tsx`

### Implementation

- [X] T029 [US2] [BACKEND] Casos de uso por obra no portal em `backend/src/Jotanunes.Docs.Application/Envios/CasosDeUsoEnvioPortal.cs`: `ListarObrasPortal`, `ListarDocumentosObraPortal`, `ListarHistoricoObraPortal`, `EnviarDocumentoObra` (resolve obra só entre vínculos ativos da empresa do token e obra ativa — research R8); `ListarDocumentosPortal`/`EnviarDocumento` restritos a `GERAL`; `BaixarArquivoPortal` exige vínculo ativo para envio por obra
- [X] T030 [US2] [BACKEND] Rotas em `backend/src/Jotanunes.Docs.Api/Endpoints/Portal/DocumentosEndpoints.cs`: `GET /obras`, `GET /obras/{obraId}/documentos`, `GET|POST /obras/{obraId}/documentos/{tipoDocumentoId}/envios` (mesmos limites de upload da rota geral; `.WithName` = operationId)
- [X] T031 [P] [US2] [PORTAL] Handlers MSW em `portal/src/mocks/handlers/documentos.ts` para as 4 rotas novas e restrição das rotas gerais a `GERAL`; chamadas novas em `portal/src/api/client.ts` (`listarObras`, `listarDocumentosObra`, `listarHistoricoObra`, `enviarDocumentoObra`)
- [X] T032 [P] [US2] [PORTAL] Criar `portal/src/components/CartaoObra.tsx` + `.css` (nome, cidade/UF, progresso escrito "X de N aprovados", pendentes/rejeitados com selo de texto, link para a obra)
- [X] T033 [US2] [PORTAL] Transformar `portal/src/pages/MeusDocumentos.tsx` no **resumo** em `/documentos`: seção "Documentos gerais da empresa" (lista atual de cartões) + seção "Suas obras" com `CartaoObra` (pendência primeiro) e estado vazio sem obras
- [X] T034 [US2] [PORTAL] Criar `portal/src/pages/DocumentosObra.tsx` (`/obras/:obraId`): título com nome da obra e cidade/UF sempre visível, "Voltar para o resumo", lista de `CartaoDocumento` por obra, envio via `enviarDocumentoObra`, estados "Nenhum documento exigido nesta obra." e "Tudo certo nesta obra."; 404 → mensagem "Obra não encontrada" e link para o resumo
- [X] T035 [US2] [PORTAL] Rotas em `portal/src/App.tsx` (`/obras/:obraId`, `/obras/:obraId/documentos/:tipoDocumentoId`); `portal/src/pages/DocumentoHistorico.tsx` passa a receber contexto geral|obra (busca o nome do documento na lista do contexto certo, mostra a obra no título, volta para a página certa); `CartaoDocumento.tsx` recebe o link de histórico/envio por props em vez de montar `/documentos/...`

**Checkpoint**: US1 + US2 = MVP (configurar na Jotanunes, enviar no portal).

---

## Phase 5: User Story 3 — Análise com a obra no contexto (P1)

**Goal**: fila, detalhe do envio e e-mail de rejeição mostram a obra.

**Independent Test**: mesmo tipo/empresa nas obras A e B na fila; filtro por A; rejeitar A não muda B (spec US3).

### Tests

- [X] T036 [P] [US3] [BACKEND] Testes em `backend/tests/Jotanunes.Docs.Api.Tests/Fluig/AnaliseObraTests.cs`: `EnvioFila.obra` preenchida/nula, `obraId` = envios da obra, `somenteGerais`, `obraId`+`somenteGerais` → 400, rejeição envia e-mail com nome da obra e link `/obras/{obraId}`, decisão aceita com vínculo encerrado/obra inativa/tipo desmarcado (FR-231)
- [X] T037 [P] [US3] [FLUIG] Testes em `fluig-app/src/pages/FilaAnalise.test.tsx` (coluna Obra, "Geral da empresa", filtros) e `fluig-app/src/pages/EnvioAnalise.test.tsx` (obra no topo, histórico da obra)

### Implementation

- [X] T038 [US3] [BACKEND] `backend/src/Jotanunes.Docs.Application/Envios/CasosDeUsoAnalise.cs` + repositório da fila: `obra` no `EnvioFilaDto`/`EnvioDto`, filtro `obraId` pelo `envios_documento.obra_id` (não mais por `obra_empresas`), `somenteGerais`; `RejeitarEnvio` passa obra para `ModelosEmail.Rejeicao`
- [X] T039 [P] [US3] [BACKEND] `backend/src/Jotanunes.Docs.Application/Emails/ModelosEmail.cs`: `Rejeicao(..., string? obra, ...)` com texto "na obra X" e link da obra; teste de modelo em `backend/tests/Jotanunes.Docs.Application.Tests/`
- [X] T040 [US3] [BACKEND] Parâmetro `somenteGerais` em `backend/src/Jotanunes.Docs.Api/Endpoints/Fluig/AnaliseEndpoints.cs`
- [X] T041 [P] [US3] [FLUIG] Handlers MSW de envios em `fluig-app/src/mocks/handlers/` (obra, filtros novos)
- [X] T042 [US3] [FLUIG] `fluig-app/src/pages/FilaAnalise.tsx`: coluna "Obra" (nome ou "Geral da empresa"), filtro Obra com opção "Somente gerais"; `fluig-app/src/pages/EnvioAnalise.tsx`: obra/“Geral da empresa” no topo junto de empresa e tipo, histórico do documento no contexto certo

---

## Phase 6: User Story 4 — Acompanhamento por obra e por empresa (P2)

**Goal**: detalhe da obra, detalhe da empresa, listas e painel com contagens gerais e por obra.

**Independent Test**: contagens do painel, detalhe da obra e detalhe da empresa batem com a contagem manual (spec US4).

### Tests

- [X] T043 [P] [US4] [BACKEND] Testes em `backend/tests/Jotanunes.Docs.Api.Tests/Fluig/AcompanhamentoObraTests.cs`: `ObraDetalhe.empresas[].documentosObra/documentosGerais/quantidadeEnviosNaObra`, `Empresa.obras[]` (`ObraNaEmpresa` com encerrados), `EmpresaResumo.documentosObra` só com filtro `obraId`, `GET /obras/{o}/empresas/{e}/documentos` e `/envios` (404 sem vínculo; responde com vínculo encerrado), `Painel.obrasComPendencia` e `empresasComPendencia` incluindo por obra, `GET /obras?comPendencia=true`; ajustar `PainelTests`, `ObrasTests`, `EmpresasTests`
- [X] T044 [P] [US4] [FLUIG] Testes em `fluig-app/src/pages/ObraDetalhe.test.tsx` (aba Empresas com duas contagens), `fluig-app/src/pages/EmpresaDetalhe.documentos.test.tsx` (gerais + bloco por obra, encerradas recolhidas), `Painel.test.tsx`, `Empresas.test.tsx`, `Obras.test.tsx`

### Implementation

- [X] T045 [US4] [BACKEND] `ObterObra`/`ListarObras` (`comPendencia`) em `backend/src/Jotanunes.Docs.Application/Obras/CasosDeUsoObras.cs`; `MontadorEmpresa`/`ListarEmpresas` em `Application/Empresas/CasosDeUsoEmpresas.cs` (`obras` como `ObraNaEmpresa`, `documentosObra` com filtro); `ObterPainel` em `Application/Painel/ObterPainel.cs` (`obrasComPendencia`); casos `ListarDocumentosEmpresaObra` e `ListarHistoricoEnviosEmpresaObra` em `Application/Envios/CasosDeUsoAnalise.cs`; `ListarDocumentosEmpresa`/histórico gerais restritos a `GERAL`
- [X] T046 [US4] [BACKEND] Rotas `GET /obras/{obraId}/empresas/{empresaId}/documentos` e `.../documentos/{tipoDocumentoId}/envios` em `backend/src/Jotanunes.Docs.Api/Endpoints/Fluig/ObrasEndpoints.cs`; filtro `comPendencia` em `GET /obras`
- [X] T047 [P] [US4] [FLUIG] Handlers MSW de obras/empresas/painel em `fluig-app/src/mocks/handlers/` com as contagens novas e as 2 rotas de documentos da empresa na obra
- [X] T048 [US4] [FLUIG] Aba "Empresas" do `fluig-app/src/pages/ObraDetalhe.tsx` (extrair `fluig-app/src/pages/obra/AbaEmpresas.tsx`): por empresa, "Documentos desta obra: X de N aprovados" e, à parte, "Gerais: X de N"; clique abre o detalhe da empresa no bloco da obra
- [X] T049 [US4] [FLUIG] `fluig-app/src/pages/EmpresaDetalhe.tsx` + `pages/empresa/SecaoDocumentos.tsx`: "Documentos gerais" (texto da linha 32 ajustado) + um bloco por obra com vínculo ativo (tabela de situação + histórico via rotas novas) + "Obras encerradas" em `<details>`; `ModalHistorico` recebe contexto geral|obra
- [X] T050 [US4] [FLUIG] `fluig-app/src/pages/Painel.tsx`: cartão "Obras com pendência" (link `/obras?comPendencia=true`), texto de empresas com pendência cobrindo gerais e obras; `Obras.tsx` com filtro "Com pendência" e coluna "Docs exigidos"; `Empresas.tsx` mostrando contagem da obra quando filtrado por obra (`ResumoDocumentos` com rótulo)

---

## Phase 7: User Story 5 — Encerrar e reabrir vínculo (P2)

**Goal**: desvincular encerra e preserva histórico; vincular de novo reabre.

**Independent Test**: envio aprovado na obra A; desvincular; portal sem a obra A; área Jotanunes com histórico em
"Vínculos encerrados"; vincular de novo: obra A volta com o aprovado (spec US5).

### Tests

- [X] T051 [P] [US5] [BACKEND] Testes em `backend/tests/Jotanunes.Docs.Api.Tests/Fluig/VinculoEncerradoTests.cs` (substituir os casos de remoção em `VinculosTiposTests`): `DELETE` encerra (204, repetir 204 sem auditoria nova), `PUT` reabre com histórico e situação anterior, auditoria `VINCULO_ENCERRADO/REABERTO`, convite lista só obras com vínculo ativo, filtro de empresas por obra ignora encerrados, `ObraDetalhe.vinculosEncerrados`
- [X] T052 [P] [US5] [FLUIG] Testes em `fluig-app/src/pages/ObraDetalhe.test.tsx`: confirmação com quantidade de envios, aba "Vínculos encerrados" com histórico, vincular de novo

### Implementation

- [X] T053 [US5] [BACKEND] `VincularEmpresa` (cria ou reabre) e `DesvincularEmpresa` (encerra) em `backend/src/Jotanunes.Docs.Application/Obras/CasosDeUsoObras.cs`; remover `RemoverVinculo` da porta e do repositório; `ListarObrasDaEmpresaAsync` usado no convite (`Application/Convites/CasosDeUsoConvites.cs`) só com vínculo ativo; `vinculosEncerrados` em `ObterObra`
- [X] T054 [P] [US5] [FLUIG] Mock de desvincular em `fluig-app/src/mocks/handlers/obras.ts` passa a encerrar (sem `splice`) e vincular reabre
- [X] T055 [US5] [FLUIG] Modal `Desvincular` de `fluig-app/src/pages/ObraDetalhe.tsx` vira "Encerrar vínculo" com texto "A empresa já enviou N documentos nesta obra. O histórico continua guardado e volta se você vincular de novo."; criar `fluig-app/src/pages/obra/AbaVinculosEncerrados.tsx` (lista com encerrado em/por e acesso ao histórico); `ModalVincularEmpresa` oferece também empresas com vínculo encerrado ("reabrir")

---

## Phase 8: Polish & Cross-Cutting

- [X] T056 [BACKEND] Rodar `dotnet test` completo (inclui `Categoria=Desempenho`) e garantir que `Desempenho/ListasTests` continua dentro da meta com envios por obra na semente de volume
- [X] T057 [P] [FLUIG] `npm run lint && npm run check:css && npm test && npm run build` em `fluig-app/`; ajustar `Perfil.comum.test.tsx` e `Perfil.semPermissao.test.tsx` para a aba "Documentos exigidos" em modo leitura
- [X] T058 [P] [PORTAL] `npm run lint && npm test && npm run build` em `portal/`; conferir contraste dos selos/cartões novos (WCAG AA)
- [X] T059 [DOCS] Notas na 001 sem apagar o registro: `specs/001-portal-documentos-terceirizadas/spec.md` (FR-015, Session 2026-09-29 "por empresa" e edge case "Empresa desvinculada…") e `data-model.md` §3/§4/§6 apontando para a 002; `README.md` citando a 002
- [X] T060 [DOCS] Executar o roteiro de `specs/002-documentos-por-obra/quickstart.md` contra a API real e registrar o resultado no próprio quickstart

---

## Dependencies & Execution Order

- **Setup (T001–T002)** → **Foundational (T003–T014)** → histórias.
- Backend: T003–T007 → T009 → T010 → T011 → T012 → histórias (US1 → US2 → US3 → US4 → US5 podem seguir nessa ordem
  num único agente; os testes de cada história podem ser escritos em paralelo).
- Fluig: T001 → T013 → T022–T025 (US1) → T041–T042 (US3) → T047–T050 (US4) → T054–T055 (US5). T024 (Abas) antes de
  T025/T048/T055.
- Portal: T002 → T014 → T031–T035 (US2). Não depende de US1/US3–US5 no front.
- Entre áreas: nenhuma dependência de código (contrato já pronto); a integração real é a T060.

## Parallel Example (agentes)

```text
Agente BACKEND : T003…T012, T015…T017, T019…T021, T026…T027, T029…T030, T036, T038…T040, T043, T045…T046, T051, T053, T056
Agente FLUIG   : T001, T013, T018, T022…T025, T037, T041…T042, T044, T047…T050, T052, T054…T055, T057
Agente PORTAL  : T002, T014, T028, T031…T035, T058
Orquestrador   : revisão, T059, T060, commits
```

## Implementation Strategy

1. **MVP** = Foundational + US1 + US2: a Jotanunes configura documentos por obra e a empresa envia por obra.
2. US3 (análise com obra) logo em seguida — sem ela a analista não sabe a obra do envio.
3. US4 e US5 completam a organização e a preservação do histórico.
4. Cada história fecha com os testes da área verdes; no fim, quickstart ponta a ponta.
