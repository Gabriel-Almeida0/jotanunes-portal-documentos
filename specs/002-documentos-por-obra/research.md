# Research — 002 Documentos por obra

Decisões técnicas que fecham a spec. Base: código atual (mapeado em 2026-10-26) e a feature 001.

## R1. Um único contrato, atualizado no lugar

- **Decision**: alterar o contrato existente `specs/001-portal-documentos-terceirizadas/contracts/openapi.yaml`
  (1.2.0 → **1.3.0**). A pasta `contracts/` desta feature traz só o documento de mudanças
  ([`contracts/mudancas-api.md`](contracts/mudancas-api.md)).
- **Rationale**: `backend` (teste `ContratoOpenApiTests`), `fluig-app` e `portal` (`npm run gen:api`) e o Swagger UI
  (`Contrato/openapi.yaml` no `.csproj` da Api) já apontam para esse arquivo; o princípio II pede contrato **único**.
- **Alternatives**: copiar o contrato para `specs/002/contracts` e repontar tudo — rejeitado: duplica a fonte de
  verdade e mexe em 4 lugares sem ganho.

## R2. Abrangência como coluna do tipo

- **Decision**: `tipos_documento.abrangencia varchar(10) not null default 'GERAL'` com check
  (`GERAL`|`POR_OBRA`); a migration preenche `GERAL` para todos os tipos existentes (FR-201).
- **Rationale**: uma abrangência por tipo (spec, glossário); default garante a migração sem backfill manual.
- **Alternatives**: tabelas separadas para tipos gerais e por obra — rejeitado: duplica cadastro, telas e regras.

## R3. Tipos exigidos por obra: tabela de marcação, desmarcar apaga a linha

- **Decision**: tabela `obra_tipos_documento (obra_id, tipo_documento_id)` com autoria. Desmarcar remove a linha;
  marcar de novo recria. O histórico não se perde porque os envios guardam `obra_id` (R4) e a auditoria registra
  marcação/desmarcação.
- **Rationale**: a spec só pede que desmarcar tire o documento das pendências e mantenha os envios (US1-AC5).
- **Alternatives**: marcação com `ativo` (soft) — rejeitado: nenhuma tela precisa de "quando foi desmarcado" além
  da auditoria.

## R4. `obra_id` opcional no envio + um único índice "vivo" com NULLS NOT DISTINCT

- **Decision**: `envios_documento.obra_id uuid null` (FK → `obras`, `Restrict`). Índice único parcial recriado como
  `(empresa_id, tipo_documento_id, obra_id) NULLS NOT DISTINCT WHERE status <> 'REJEITADO'`, **mesmo nome**
  `ix_envios_documento_vivo`.
- **Rationale**: PostgreSQL 16 suporta `NULLS NOT DISTINCT`; mantendo o nome, o mapeamento de 23505 →
  `ENVIO_NAO_PERMITIDO` em `UnidadeTrabalhoEf` continua igual. Gerais (obra nula) continuam com um vivo por empresa ×
  tipo; por obra, um vivo por obra × empresa × tipo.
- **Consistência**: o domínio garante `obra_id` nulo ⇔ tipo `GERAL` (`EnvioDocumento.Criar` recebe a abrangência);
  check no banco não é possível (abrangência está em outra tabela).
- **Alternatives**: dois índices parciais (`obra_id is null` / `is not null`) — equivalente, mas troca o nome usado
  no mapeamento de erro. Coluna `obra_id` obrigatória com "obra geral" fictícia — rejeitado: dado falso.

## R5. Vínculo encerrado em vez de apagado

- **Decision**: `obra_empresas` ganha `ativo bool not null default true`, `encerrado_em timestamptz null`,
  `encerrado_por_login varchar(100) null`. `DELETE /obras/{o}/empresas/{e}` passa a **encerrar**; `PUT` no mesmo
  caminho cria **ou reabre** (limpa `encerrado_*`, atualiza `vinculado_em/por`). `RemoverVinculo` deixa de existir.
- **Rationale**: FR-220/221; mesmo par de rotas, sem quebrar o front além do texto.
- **Efeito colateral**: toda leitura de "obras da empresa" e "empresas da obra" passa a filtrar `ativo = true`
  (convite, filtro de lista por obra, portal), e o detalhe da obra lista os encerrados à parte.

## R6. Situação e contagens por obra

- **Decision**: `RegraSituacaoDocumento.De` não muda (recebe a lista de envios de um documento). O que muda é quem
  monta a lista:
  - **Gerais**: envios com `obra_id is null` × tipos `GERAL` ativos (a contagem `total` passa a ser só os gerais).
  - **Por obra**: envios com `obra_id = X` × tipos marcados em `obra_tipos_documento` para X e ativos.
  - `IConsultaDocumentos` ganha `ContarPorObraAsync(obraId, empresaIds)`; `ContarPorEmpresaAsync` passa a contar
    só gerais.
  - "Exigido" por obra (FR-204) = empresa ativa ∧ vínculo ativo ∧ obra ativa ∧ tipo ativo ∧ marcado.
- **Pendência** (`ConsultasEmpresa.ComPendencia`, painel): existe tipo geral ativo sem vivo **ou** existe (vínculo
  ativo em obra ativa, tipo marcado ativo) sem vivo daquela obra. Painel ganha `obrasComPendencia` (obras ativas com
  ao menos uma empresa ativa vinculada pendente) e `GET /obras` ganha o filtro `comPendencia`.
- **Rationale**: uma regra só, reaproveitada; consultas em SQL (EF) como hoje, sem cache (princípio VI).

## R7. Rotas novas seguem a hierarquia obra → empresa → documentos

- **Decision**: as rotas de documentos **gerais** existentes continuam (agora só gerais). Rotas novas para por obra
  (detalhe em [`contracts/mudancas-api.md`](contracts/mudancas-api.md)):
  - Área Jotanunes: `GET /obras/{o}/tipos-documento`, `PUT|DELETE /obras/{o}/tipos-documento/{t}` (admin),
    `GET /obras/{o}/empresas/{e}/documentos`, `GET /obras/{o}/empresas/{e}/documentos/{t}/envios`.
  - Portal: `GET /portal/obras`, `GET /portal/obras/{o}/documentos`, `GET|POST /portal/obras/{o}/documentos/{t}/envios`.
- **Rationale**: aditivo (menos quebra nos fronts), espelha o modelo mental pedido ("obra, empresa, documentos") e
  deixa o isolamento explícito: o `{o}` do portal é sempre conferido contra os vínculos ativos da empresa do token.
- **Alternatives**: `?obraId=` nas rotas atuais — rejeitado: mistura duas regras de exigência numa rota e torna
  ambíguo "sem obraId".

## R8. Isolamento no portal

- **Decision**: rotas `/portal/obras/{o}/…` resolvem a obra **somente** entre as obras com vínculo ativo da empresa
  do token e obra ativa; qualquer outro caso → 404 `NAO_ENCONTRADO` (inclui obra de outra empresa, vínculo
  encerrado, obra inativa). Tipo não marcado na obra, tipo `GERAL` na rota de obra ou tipo `POR_OBRA` na rota geral
  → 404. Download `/portal/envios/{id}/arquivo` de envio por obra exige o mesmo vínculo ativo (spec, edge case).
- **Testes**: casos negativos explícitos em `Portal/DocumentosObraTests` (princípio IV).

## R9. Troca de abrangência

- **Decision**: `PUT /tipos-documento/{t}` aceita `abrangencia`; se mudar e o tipo tiver qualquer envio → 409
  `ABRANGENCIA_IMUTAVEL`. `POR_OBRA → GERAL` sem envios remove as marcações em obras na mesma transação.

## R10. Auditoria

- **Decision**: ações novas `TIPO_ABRANGENCIA_ALTERADA` (recurso `TIPO_DOCUMENTO`), `OBRA_TIPO_MARCADO`,
  `OBRA_TIPO_DESMARCADO` (recurso `OBRA`, id = obra; o tipo vai em `recurso_id` composto `obraId:tipoId`),
  `VINCULO_ENCERRADO`, `VINCULO_REABERTO` (recurso `VINCULO`, id `obraId:empresaId`). O envio já é auditado com o id
  do envio, que guarda `obra_id` (FR-260). Os textos cabem em `varchar(40)`/`varchar(100)`; sem coluna nova.

## R11. E-mails

- **Decision**: `ModelosEmail.Rejeicao` ganha `string? obra`; com obra, o texto diz "na obra X" e o link aponta
  para `{BaseUrl}/obras/{obraId}`; sem obra, igual a hoje. Convite: lista só obras com vínculo ativo (R5).

## R12. UI: abas e seções recolhíveis sem biblioteca

- **Decision**: `fluig-app` ganha um componente `Abas` (padrão WAI-ARIA tabs, CSS puro com tokens `--jn-*`) para o
  detalhe da obra; seções recolhidas usam `<details>/<summary>` nativo estilizado. Portal: rota nova
  `/obras/:obraId` e `/obras/:obraId/documentos/:tipoDocumentoId`; `/documentos` vira o **resumo** (gerais + cartões
  de obra), mantendo o caminho para não quebrar links de e-mail existentes.
- **Rationale**: princípio V (sem framework de CSS); nada disso existe hoje (mapeamento: sem tabs/collapsible).

## R13. Fatiamento para agentes

- **Decision**: depois do contrato 1.3.0 e de `gen:api` nos dois fronts, três frentes independentes, uma por área
  (`[BACKEND]`, `[FLUIG]`, `[PORTAL]`), cada uma num agente, sem editar pasta de outra área. Os fronts trabalham
  contra os mocks MSW atualizados a partir do contrato; a integração real fica no quickstart.
