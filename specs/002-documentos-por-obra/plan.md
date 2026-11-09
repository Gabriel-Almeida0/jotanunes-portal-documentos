# Implementation Plan: Documentos por obra

**Branch**: `002-documentos-por-obra` | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-documentos-por-obra/spec.md`

## Summary

Os tipos de documento ganham **abrangência** (`GERAL` | `POR_OBRA`). Os gerais seguem a regra da 001 (todos os
tipos e envios existentes viram gerais, sem migração de dados). Cada obra marca quais tipos `POR_OBRA` exige; o
envio ganha `obra_id` opcional e a situação/contagem passa a ser calculada também por obra × empresa × tipo. O
vínculo obra–empresa deixa de ser apagado e passa a ser encerrado/reaberto. O contrato único sobe para 1.3.0 com 9
rotas novas na hierarquia obra → empresa → documentos (research R7). A área Jotanunes reorganiza o detalhe da obra
em abas (Empresas / Documentos exigidos / Vínculos encerrados), o detalhe da empresa em "Gerais" + um bloco por obra,
e a fila mostra a obra. O portal abre num resumo (gerais + um cartão por obra) e tem uma página por obra.

## Technical Context

**Language/Version**: C# / .NET 8 (backend); TypeScript 5 + React 18 (fluig-app, portal)

**Primary Dependencies**: ASP.NET Core minimal APIs, EF Core 8 + Npgsql, BCrypt, Resend; Vite, React Router,
openapi-typescript, MSW

**Storage**: PostgreSQL 16 (migration EF `DocumentosPorObra`); arquivos atrás de `IFileStorage` (disco local), sem
mudança de chave

**Testing**: xUnit + Testcontainers (Postgres 16 real) no backend; Vitest + Testing Library + MSW nos fronts

**Target Platform**: Linux (VPS, systemd) para a API; navegadores atuais; `fluig-app` embutido no Fluig

**Project Type**: web — API + dois SPAs

**Performance Goals**: metas da 001 (listas e painel rápidos com centenas de empresas, dezenas de obras, ~20 mil
envios); contagens por obra em SQL agregado, sem N+1 por empresa

**Constraints**: contrato único (princípio II); sem framework de CSS (V); isolamento por empresa do token e por
vínculo ativo (III); nada apagado definitivamente pela interface

**Scale/Scope**: ~10 tipos por obra, dezenas de obras, centenas de empresas; 9 operações novas (43 → 52)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Situação | Como |
|---|---|---|
| I. Hexagonal | ✅ | Abrangência, regra de exigência e encerramento de vínculo no `Domain`; casos de uso e portas novas (`IObraRepositorio` tipos exigidos, `IConsultaDocumentos.ContarPorObraAsync`) na `Application`; EF/migration na `Infrastructure`; rotas só mapeiam na `Api` |
| II. Contrato como fonte | ✅ | Contrato atualizado **antes** do código (Phase 1, [mudancas-api.md](contracts/mudancas-api.md) → `openapi.yaml` 1.3.0); `ContratoOpenApiTests` passa a 52 operações; `gen:api` nos dois fronts |
| III. Segurança/LGPD | ✅ | Rotas de obra do portal resolvem a obra só entre vínculos ativos da empresa do token (R8), 404 em todo o resto; download de envio de obra exige vínculo ativo; novas rotas de escrita marcadas `x-requer-admin` |
| IV. Testes | ✅ | Unit (regra de exigência, troca de abrangência, encerrar/reabrir), integração por endpoint novo, negativos de isolamento por obra; `PerfilAdminTests` classifica as 2 rotas novas de escrita (nas duas origens) |
| V. Identidade visual | ✅ | `Abas` e `<details>` com CSS puro e tokens `--jn-*`; status com texto; `check:css`/lint de framework continuam no CI |
| VI. Simplicidade | ✅ | Sem cache nem tabelas extras além de `obra_tipos_documento`; reaproveita `RegraSituacaoDocumento`; um índice "vivo" com `NULLS NOT DISTINCT` |

Re-check pós-design (Phase 1): sem violações. **Complexity Tracking**: vazio.

Nota de governança: a 002 substitui decisões **VALIDADAS** da 001 (FR-015 e "desvincular remove o vínculo"). A 001
recebe nota apontando para a 002 nos pontos afetados (tarefa de documentação), sem apagar o registro anterior
(constituição, "Fluxo de Desenvolvimento").

## Project Structure

### Documentation (this feature)

```text
specs/002-documentos-por-obra/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── mudancas-api.md      # o contrato em si continua em specs/001-.../contracts/openapi.yaml (1.3.0)
├── checklists/requirements.md
└── tasks.md                 # /speckit-tasks
```

### Source Code (repository root)

```text
backend/
├── src/Jotanunes.Docs.Domain/
│   ├── TiposDocumento/TipoDocumento.cs        # + Abrangencia, TrocarAbrangencia
│   ├── TiposDocumento/Abrangencia.cs          # novo enum
│   ├── Obras/ObraEmpresa.cs                   # + Ativo, Encerrar(), Reabrir()
│   ├── Obras/ObraTipoDocumento.cs             # novo
│   ├── Envios/EnvioDocumento.cs               # + ObraId (Criar valida abrangência)
│   └── Auditoria/RegistroAuditoria.cs         # ações novas (R10)
├── src/Jotanunes.Docs.Application/
│   ├── Portas/Persistencia.cs                 # portas estendidas
│   ├── TiposDocumento/CasosDeUsoTipos.cs      # abrangência
│   ├── Obras/CasosDeUsoObras.cs               # tipos exigidos, encerrar/reabrir, detalhe por obra
│   ├── Envios/CasosDeUsoEnvioPortal.cs        # envio/listas por obra no portal
│   ├── Envios/CasosDeUsoAnalise.cs            # fila com obra, docs da empresa na obra
│   ├── Painel/ObterPainel.cs                  # obrasComPendencia
│   ├── Emails/ModelosEmail.cs                 # rejeição com obra
│   └── Dtos/Dtos.cs
├── src/Jotanunes.Docs.Infrastructure/Persistencia/
│   ├── DocsDbContext.cs                       # mapeamentos + índice vivo
│   ├── Migrations/*_DocumentosPorObra.cs
│   ├── Repositorios/Repositorios.cs
│   └── Consultas/ConsultaDocumentosEf.cs      # ContarPorObraAsync, pendência por obra
├── src/Jotanunes.Docs.Api/Endpoints/{Fluig,Portal}/   # 9 rotas novas
└── tests/                                     # Domain, Application, Api (Contrato, Autorizacao, Fluig, Portal)

fluig-app/src/
├── api/{schema.d.ts,tipos.ts,fluig.ts}        # gen:api + chamadas novas
├── components/Abas.tsx, Recolhivel (details)  # novos
├── pages/TiposDocumento.tsx                   # abrangência no formulário/lista/filtro
├── pages/ObraDetalhe.tsx (+ pages/obra/*)     # abas Empresas / Documentos exigidos / Vínculos encerrados
├── pages/EmpresaDetalhe.tsx, pages/empresa/SecaoDocumentos.tsx  # gerais + bloco por obra
├── pages/FilaAnalise.tsx, EnvioAnalise.tsx    # coluna/filtro de obra, "Somente gerais"
├── pages/Painel.tsx, Empresas.tsx, Obras.tsx  # obras com pendência, contagens separadas
└── mocks/{dados.ts,handlers/*}                # modelo por obra

portal/src/
├── api/{schema.d.ts,tipos.ts,client.ts}
├── App.tsx                                    # /documentos (resumo + gerais), /documentos/:tipo (histórico geral, como hoje), /obras/:obraId, /obras/:obraId/documentos/:tipo
├── pages/MeusDocumentos.tsx → Resumo + DocumentosGerais + DocumentosObra
├── pages/DocumentoHistorico.tsx               # contexto geral|obra
├── components/CartaoObra.tsx                  # novo
└── mocks/{dados.ts,handlers/documentos.ts}
```

**Structure Decision**: mesma estrutura da 001 (web: `backend/` + `fluig-app/` + `portal/`). Cada área é uma frente
de trabalho de um agente (research R13), depois do contrato.

## Ordem de execução (para tasks e agentes)

1. **Contrato 1.3.0** (Phase 1, feito) → `gen:api` nos dois fronts.
2. Em paralelo, três agentes, um por área, sem editar pastas alheias:
   - `[BACKEND]` domínio → migration → casos de uso → rotas → testes (contrato 52, perfis, isolamento).
   - `[FLUIG]` mocks MSW → tipos (abrangência) → obra (abas) → empresa → fila/envio → painel/listas → testes.
   - `[PORTAL]` mocks MSW → resumo → página da obra → histórico/envio por obra → testes.
3. Integração: quickstart ponta a ponta contra a API real; ajustes.
4. Documentação: notas na 001 (spec FR-015, data-model §3), README/quickstart.

## Complexity Tracking

Sem violações da constituição.
