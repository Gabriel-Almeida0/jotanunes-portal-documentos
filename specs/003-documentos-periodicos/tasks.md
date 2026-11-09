---

description: "Lista de tarefas — 003 Documentos periódicos"
---

# Tasks: Documentos periódicos

**Input**: `/specs/003-documentos-periodicos/` — plan.md, spec.md, research.md, data-model.md,
contracts/mudancas-api.md, quickstart.md. Contrato: `specs/001-portal-documentos-terceirizadas/contracts/openapi.yaml`
**1.4.0** (56 operações).

**Tests**: INCLUÍDOS (constituição IV). Teste antes, veja falhar.

## Format: `[ID] [P?] [Story] [ÁREA] Description`

`[BACKEND]` só `backend/`; `[FLUIG]` só `fluig-app/`; `[PORTAL]` só `portal/`; `[DOCS]` só `specs/`/`README.md`.

## Regras para os agentes

Iguais às da [002](../002-documentos-por-obra/tasks.md#regras-para-os-agentes): contrato é fonte de verdade e ninguém o
edita; fronts contra MSW; backend com Testcontainers; CSS puro com tokens; textos em português; não commitar; não usar
`git stash` (outros agentes trabalham na mesma pasta); não rodar formatador que não seja o do projeto.

---

## Phase 1: Setup

- [X] T001 [P] [FLUIG] `npm run gen:api` em `fluig-app/` (contrato 1.4.0) + aliases em `fluig-app/src/api/tipos.ts` (`Periodicidade`, `UnidadePeriodicidade`, `Periodo`, `PeriodoRef`, `ResumoPeriodos`); mensagens de `PERIODICIDADE_IMUTAVEL` e `PERIODO_OBRIGATORIO` em `fluig-app/src/api/mensagens.ts`
- [X] T002 [P] [PORTAL] `npm run gen:api` em `portal/` + aliases (`PeriodoPortal`, `PeriodoRef`, `ResumoPeriodos`, `Periodicidade`) em `portal/src/api/tipos.ts`; mensagens dos 2 códigos novos em `portal/src/api/mensagens.ts`

## Phase 2: Foundational

### BACKEND

- [X] T003 [BACKEND] `backend/src/Jotanunes.Docs.Domain/TiposDocumento/Periodicidade.cs` (value object: `Unidade` `UNICA|MESES|DIAS`, `Intervalo` "MESES 1–24; DIAS 1–365; null se UNICA", `PrazoDias` "0–90; null se UNICA"; fábricas `Unica()`, `Meses(n, prazo)`, `Dias(n, prazo)`; `Descricao()` pt-BR — "Mensal · até o dia 15 do mês seguinte", "A cada 3 meses · até 10 dias após o fim do período", "A cada 30 dias · …") e `TipoDocumento` com `Periodicidade`, `CobrancaDesde` (= criação; = agora ao reativar ou ao passar de única para periódico) e `AlterarPeriodicidade(nova, temEnvios)` → erro `PERIODICIDADE_IMUTAVEL` se unidade/intervalo mudam com envios (prazo muda sempre)
- [X] T004 [P] [BACKEND] `backend/src/Jotanunes.Docs.Domain/Envios/CalendarioPeriodos.cs`: função pura `Gerar(periodicidade, DateOnly inicioCobranca, DateOnly hoje)` → períodos `(Inicio, Fim, Prazo, Rotulo)` do primeiro até o que contém `hoje` (data-model §3; MESES ancorado no dia 1 do mês de início; DIAS no próprio dia); `Rotulo` pt-BR (research R9); conversão UTC → America/Sao_Paulo em helper `DataLocal`
- [X] T005 [P] [BACKEND] `backend/src/Jotanunes.Docs.Domain/Envios/RegraPeriodos.cs`: situação por período (reusa `RegraSituacaoDocumento.De`), `atrasado`, `podeEnviar`, situação resumida (prioridade Atrasado > Rejeitado > Pendente > Em análise > Aprovado) e contagens; `EnvioDocumento.Criar` recebe período opcional e calcula `EnviadoComAtraso` (período obrigatório ⇔ tipo periódico)
- [X] T006 [P] [BACKEND] Testes de domínio em `backend/tests/Jotanunes.Docs.Domain.Tests/` (`CalendarioPeriodosTests`: mensal desde meio do mês, trimestral começando em fevereiro, anual cruzando ano, 30 dias, fevereiro/ano bissexto, hoje = último dia, fuso 23h UTC−3; `RegraPeriodosTests`; `PeriodicidadeTests` com limites e descrições)
- [X] T007 [BACKEND] Ação `TIPO_PERIODICIDADE_ALTERADA` em `RegistroAuditoria.cs`; códigos `PERIODICIDADE_IMUTAVEL` (409) e `PERIODO_OBRIGATORIO` (400) em `Application/Erros`
- [X] T008 [BACKEND] `DocsDbContext.cs`: `tipos_documento.periodicidade_unidade varchar(10) not null default 'UNICA'` (check), `periodicidade_intervalo int null`, `prazo_dias int null` (checks de faixa), `cobranca_desde timestamptz not null`; `envios_documento.periodo_inicio date null`, `periodo_fim date null`, `enviado_com_atraso bool not null default false`; `ix_envios_documento_vivo` em `(empresa_id, tipo_documento_id, obra_id, periodo_inicio)` NULLS NOT DISTINCT WHERE `status <> 'REJEITADO'`; índice `(empresa_id, tipo_documento_id, obra_id, periodo_inicio, enviado_em desc) WHERE periodo_inicio is not null`
- [X] T009 [BACKEND] Migration `DocumentosPeriodicos` (`dotnet ef migrations add`): `cobranca_desde` preenchido com `criado_em` antes do NOT NULL; tipos existentes `UNICA`; conferir SQL do índice; `has-pending-model-changes` limpo
- [X] T010 [BACKEND] Portas e adaptadores: envios por período (`ExisteVivoAsync` com período; listas/histórico com `periodoInicio`), consulta agregada dos envios periódicos por (empresa, obra, tipo, período) para as contagens; `TemEnviosAsync` já existe; corrigir testes quebrados e `Semente.cs` com ajudantes de tipo periódico e relógio fixo

### FLUIG / PORTAL — mocks

- [X] T011 [P] [FLUIG] `fluig-app/src/mocks/dados.ts`: tipos com `periodicidade` (semente: + "Guia do FGTS" geral mensal prazo 15 com cobrança desde 3 meses antes da data fixa dos testes, + "Relatório trimestral" por obra a cada 3 meses prazo 10), envios com `periodo`/`enviadoComAtraso`, gerador de períodos igual ao data-model §3 (com rótulo pt-BR), situação resumida, `periodosAtrasados`, `empresasComAtraso`
- [X] T012 [P] [PORTAL] `portal/src/mocks/dados.ts`: mesma modelagem para a empresa do portal (geral mensal + por obra trimestral), envios por período

---

## Phase 3: US1 — Configurar periodicidade (P1) 🎯

**Independent Test**: criar "Guia do FGTS" Mensal prazo 15; lista mostra a descrição; trocar para Único depois de
envio → 409.

- [X] T013 [P] [US1] [BACKEND] Testes `backend/tests/Jotanunes.Docs.Api.Tests/Fluig/TiposPeriodicidadeTests.cs`: criar sem periodicidade = UNICA; MESES/DIAS com limites (400 fora da faixa); `descricao` na resposta; filtro `periodico`; 409 `PERIODICIDADE_IMUTAVEL`; prazo muda com envios; reativar atualiza `cobranca_desde`; auditoria
- [X] T014 [US1] [BACKEND] `CasosDeUsoTipos.cs` + DTOs + `TiposDocumentoEndpoints.cs` (filtro `periodico`)
- [X] T015 [P] [US1] [FLUIG] Testes em `fluig-app/src/components/FormularioTipo.test.tsx` (seleção da lista pronta, N e prazo, prévia em texto, validação de faixa, 409) e `pages/TiposDocumento.test.tsx` (coluna e filtro)
- [X] T016 [US1] [FLUIG] `fluig-app/src/components/FormularioTipo.tsx`: campo "Periodicidade" (Único, Mensal, Bimestral, Trimestral, Semestral, Anual, A cada N meses, A cada N dias), campo N quando personalizado, "Prazo para enviar (dias após o fim do período)" padrão 15, prévia (FR-332) — vale também no "Novo tipo por obra"; `pages/TiposDocumento.tsx`: coluna "Periodicidade" (texto `descricao`) e filtro Únicos/Periódicos; mock handlers de tipos

## Phase 4: US2 — Envio por período no portal (P1)

**Independent Test**: 3 meses de vínculo com mensal: períodos certos, atrasados marcados, envio muda só o período.

- [X] T017 [P] [US2] [BACKEND] Testes `backend/tests/Jotanunes.Docs.Api.Tests/Portal/PeriodosPortalTests.cs`: listas de períodos (geral e obra) com relógio fixo; envio com `periodoInicio` (ok, atrasado marcado, futuro → 404, data que não é início → 404, sem período em periódico → 400, período em único → 400, segundo envio no mesmo período → 409, períodos diferentes ok); `DocumentoSituacaoPortal.periodos`/`atrasado`; histórico filtrado por período; isolamento (outra empresa, obra sem vínculo → 404)
- [X] T018 [US2] [BACKEND] Casos de uso e rotas do portal: `portalListarPeriodos`, `portalListarPeriodosObra`, upload com `periodoInicio`, históricos com `periodoInicio`, listas com resumo de períodos
- [X] T019 [P] [US2] [PORTAL] Testes em `portal/src/pages/PeriodosDocumento.test.tsx` e `portal/src/components/CartaoDocumento.test.tsx` (cartão periódico com descrição, "N atrasados", próximo período e prazo; página de períodos: ordem, recolhidos, envio só no período, "enviado com atraso")
- [X] T020 [US2] [PORTAL] `CartaoDocumento.tsx`: para periódico, descrição da periodicidade, resumo ("2 atrasados · 1 em análise"), "Próximo: Outubro/2026 · até 15/11/2026" e botão "Ver períodos" (sem envio direto no cartão); selo "Atrasado" com texto
- [X] T021 [US2] [PORTAL] `portal/src/pages/PeriodosDocumento.tsx` + rotas `/documentos/:tipoDocumentoId/periodos` e `/obras/:obraId/documentos/:tipoDocumentoId/periodos` em `App.tsx`: título com documento (e obra), lista do mais recente ao mais antigo com os que pedem ação primeiro e "Períodos anteriores" em `<details>`; cada período com prazo, situação, motivo, envio (`EnvioArquivo` com `periodoInicio`) e histórico do período; `api/client.ts` + mocks

## Phase 5: US3 — Análise e acompanhamento por período (P1)

- [X] T022 [P] [US3] [BACKEND] Testes `backend/tests/Jotanunes.Docs.Api.Tests/Fluig/PeriodosAnaliseTests.cs`: `fluigListarPeriodosEmpresa(Obra)`; `Envio.periodo`/`enviadoComAtraso` na fila e detalhe; filtro `comAtraso` em envios e empresas; `ContagemDocumentos.periodosAtrasados`; `Painel.empresasComAtraso`; empresa com pendência inclui atraso; e-mail de rejeição com o rótulo do período; ajustar `ContratoOpenApiTests` (56) e o teste de volume (tipos mensais na semente)
- [X] T023 [US3] [BACKEND] Casos de uso/rotas Jotanunes: períodos, fila (`comAtraso`), empresas (`comAtraso`), contagens e painel, `ModelosEmail.Rejeicao` com período
- [X] T024 [P] [US3] [FLUIG] Testes em `FilaAnalise.test.tsx`, `EnvioAnalise.test.tsx`, `Painel.test.tsx`, `EmpresaDetalhe.documentos.test.tsx`, `components/ModalPeriodos.test.tsx`
- [X] T025 [US3] [FLUIG] `components/ModalPeriodos.tsx` (lista de períodos com situação, prazo, atraso, quem analisou, link para o envio) usado em `pages/empresa/SecaoDocumentos.tsx` (gerais e blocos de obra: "Guia do FGTS — 3 atrasados · Ver períodos") e `pages/obra/AbaEmpresas.tsx` (contagem com "N períodos atrasados")
- [X] T026 [US3] [FLUIG] `FilaAnalise.tsx` (rótulo do período junto do documento, selo "Com atraso", filtro "Com atraso"), `EnvioAnalise.tsx` (período e prazo no topo, histórico do período), `Painel.tsx` (cartão "Empresas com período atrasado" → `/empresas?comAtraso=true`), `Empresas.tsx` (filtro "Com atraso"); mocks

## Phase 6: Polish

- [X] T027 [BACKEND] `dotnet test` completo verde (inclui Desempenho)
- [X] T028 [P] [FLUIG] lint, `check:css`, test, build
- [X] T029 [P] [PORTAL] lint, test, build; contraste dos selos novos
- [X] T030 [DOCS] notas na 001/002 (FR-015 e "Situação do documento" do data-model apontando para a 003) e README
- [X] T031 [DOCS] roteiro do `quickstart.md` contra a API real (banco descartável) e resultado registrado

## Dependencies

Setup → Foundational → US1 → US2/US3 (backend em sequência num agente; fronts independentes entre si). Sem dependência
de código entre áreas (contrato pronto).

## Parallel Example (agentes)

```text
BACKEND : T003–T010, T013–T014, T017–T018, T022–T023, T027
FLUIG   : T001, T011, T015–T016, T024–T026, T028
PORTAL  : T002, T012, T019–T021, T029
Orquestrador: T030, T031, commits
```

## Implementation Strategy

MVP = Foundational + US1 + US2 (configurar e a empresa enviar por período); US3 em seguida (análise e atrasos).
