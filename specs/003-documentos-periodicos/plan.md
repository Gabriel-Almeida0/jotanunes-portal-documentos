# Implementation Plan: Documentos periódicos

**Branch**: `003-documentos-periodicos` | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)

## Summary

Tipos de documento ganham **periodicidade** (unidade `UNICA`|`MESES`|`DIAS` + intervalo N) e **prazo** em dias após o
fim do período. Os períodos são **derivados** (função pura no domínio) desde o início da cobrança até o período em
curso; cada envio guarda o período (`periodo_inicio/fim`) e se foi feito com atraso. A situação por período reaproveita
`RegraSituacaoDocumento`; o documento periódico tem uma situação resumida e conta uma vez nas contagens, com
`periodosAtrasados` à parte. Contrato 1.4.0 (+4 rotas de períodos). Telas: formulário de tipo com periodicidade e
prévia; lista de períodos no portal (com envio por período) e na área Jotanunes; período na fila/envio/e-mail; painel
com empresas com atraso.

## Technical Context

**Language/Version**: C# / .NET 8; TypeScript 5 + React 18

**Primary Dependencies**: ASP.NET Core, EF Core 8 + Npgsql; Vite, openapi-typescript, MSW

**Storage**: PostgreSQL 16 — migration `DocumentosPeriodicos` (colunas em `tipos_documento` e `envios_documento`,
índice vivo com `periodo_inicio`)

**Testing**: xUnit + Testcontainers; Vitest + Testing Library + MSW

**Target Platform / Project Type**: API Linux + 2 SPAs (igual à 001/002)

**Performance Goals**: metas da 001; até ~25 períodos por documento periódico; teste de volume ganha tipos mensais

**Constraints**: datas de período no fuso America/Sao_Paulo; sem rotina agendada; contrato único; CSS puro

**Scale/Scope**: 4 operações novas (52 → 56); 2 erros novos

## Constitution Check

| Princípio | Situação | Como |
|---|---|---|
| I. Hexagonal | ✅ | `CalendarioPeriodos` e regra de atraso no `Domain` (puros, recebem `hoje`); casos de uso/portas na `Application`; EF na `Infrastructure` |
| II. Contrato | ✅ | 1.4.0 aplicado antes do código ([mudancas-api.md](contracts/mudancas-api.md)); teste de contrato → 56 |
| III. Segurança | ✅ | rotas de períodos do portal com as mesmas regras de isolamento da 002 R8; `periodoInicio` validado no servidor contra os períodos exigidos |
| IV. Testes | ✅ | unit do calendário (meses/dias, viradas de ano, fevereiro, fuso), integração das 4 rotas, isolamento, `PerfilAdminTests` sem rotas de escrita novas |
| V. Visual | ✅ | campos e listas com CSS puro e tokens; "Atrasado" com texto e ícone |
| VI. Simplicidade | ✅ | períodos derivados, sem tabela nem job |

Re-check pós-design: sem violações. Complexity Tracking: vazio.

## Project Structure

```text
specs/003-documentos-periodicos/{plan,research,data-model,quickstart,tasks}.md, contracts/mudancas-api.md

backend/src/Jotanunes.Docs.Domain/TiposDocumento/{Periodicidade.cs (novo), TipoDocumento.cs}
backend/src/Jotanunes.Docs.Domain/Envios/{CalendarioPeriodos.cs (novo), RegraPeriodos.cs (novo), EnvioDocumento.cs}
backend/src/Jotanunes.Docs.Application/{TiposDocumento,Envios,Empresas,Obras,Painel,Emails,Dtos,Portas}/…
backend/src/Jotanunes.Docs.Infrastructure/Persistencia/{DocsDbContext.cs, Migrations/*_DocumentosPeriodicos.cs, Repositorios, Consultas}
backend/src/Jotanunes.Docs.Api/Endpoints/{Fluig,Portal}/…
backend/tests/…

fluig-app/src/components/{FormularioTipo.tsx, ModalPeriodos.tsx (novo), SeloAtraso}
fluig-app/src/pages/{TiposDocumento, FilaAnalise, EnvioAnalise, Painel, Empresas, empresa/SecaoDocumentos, obra/AbaEmpresas}.tsx
fluig-app/src/mocks/{dados.ts, handlers/*}

portal/src/components/{CartaoDocumento.tsx, EnvioArquivo.tsx}
portal/src/pages/{PeriodosDocumento.tsx (novo), DocumentoHistorico.tsx}, App.tsx
portal/src/mocks/{dados.ts, handlers/documentos.ts}
```

**Structure Decision**: igual à 002; uma frente por área, cada uma num agente, depois do contrato 1.4.0.
