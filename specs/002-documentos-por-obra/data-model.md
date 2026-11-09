# Data Model — 002 Documentos por obra (mudanças sobre a 001)

Base: [`001/data-model.md`](../001-portal-documentos-terceirizadas/data-model.md). Só o que muda está aqui; o
resto continua como na 001. Migration EF nova: **`DocumentosPorObra`**.

## Diagrama

```text
obras 1───* obra_empresas (ativo/encerrado) *───1 empresas
  │                                                │
  1                                                1
  │                                                │
  *  obra_tipos_documento  *───1 tipos_documento (abrangencia)
                                   │
                                   1
                                   │
                                   *
                           envios_documento ── empresa_id (1), obra_id (0..1)
```

## 1. Tipo de documento (`tipos_documento`) — alterado

| Campo | Tipo | Regras |
|---|---|---|
| abrangencia | varchar(10) | **novo**; `GERAL` \| `POR_OBRA`; not null default `GERAL`; check |

- Migration: tipos existentes ficam `GERAL` (FR-201). Catálogo padrão (FR-090 da 001) cria `GERAL`.
- Troca de abrangência só sem envios (409 `ABRANGENCIA_IMUTAVEL`); `POR_OBRA → GERAL` apaga as linhas de
  `obra_tipos_documento` do tipo na mesma transação.
- Regra da 001 "todo tipo ativo é exigido de toda empresa ativa" passa a ser "todo tipo **GERAL** ativo".

## 2. Tipo exigido da obra (`obra_tipos_documento`) — novo

| Campo | Tipo | Regras |
|---|---|---|
| obra_id | uuid FK → obras (Restrict) | PK composta (obra_id, tipo_documento_id) |
| tipo_documento_id | uuid FK → tipos_documento (Restrict) | só tipo `POR_OBRA` (validado no caso de uso; 400 `TIPO_NAO_E_POR_OBRA`) |
| marcado_em / marcado_por_login | timestamptz / varchar(100) | |

- Marcar de novo é idempotente (204). Desmarcar remove a linha (204; idempotente se não existir).
- Marcar tipo inativo: permitido (fica marcado, só passa a valer quando o tipo for reativado). A tela só oferece
  tipos ativos.
- Índice: `tipo_documento_id`.

## 3. Vínculo obra–empresa (`obra_empresas`) — alterado

| Campo | Tipo | Regras |
|---|---|---|
| ativo | bool | **novo**; not null default `true` |
| encerrado_em / encerrado_por_login | timestamptz null / varchar(100) null | **novo**; preenchidos ao encerrar, limpos ao reabrir |

- `PUT` vincular: cria; se existir encerrado → reabre (`ativo = true`, limpa `encerrado_*`, `vinculado_em/por` =
  agora/quem reabriu); se já ativo → nada (204).
- `DELETE` desvincular: encerra (`ativo = false`, `encerrado_*`); se já encerrado → 204 sem mudança; se não
  existir → 404.
- Toda consulta de "empresas da obra"/"obras da empresa" usada em convite, filtro por obra, painel e portal filtra
  `ativo = true`. Índice: `(empresa_id) WHERE ativo`.

## 4. Envio de documento (`envios_documento`) — alterado

| Campo | Tipo | Regras |
|---|---|---|
| obra_id | uuid null FK → obras (Restrict) | **novo**; nulo ⇔ tipo `GERAL`; obrigatório para `POR_OBRA` |

- Envios existentes: `obra_id = null` (gerais) — sem backfill.
- Índice único "vivo" recriado: `ix_envios_documento_vivo` em `(empresa_id, tipo_documento_id, obra_id)
  NULLS NOT DISTINCT WHERE status <> 'REJEITADO'`.
- Índices novos: `(obra_id, empresa_id, tipo_documento_id, enviado_em desc) WHERE obra_id is not null`; o índice
  da fila `(status, enviado_em)` continua.
- `chave_armazenamento` não muda (`empresas/{empresaId:N}/{id:N}`; o id do envio já é único).
- Máquina de estados do envio: igual à 001.

## 5. Situação do documento (derivada) — alterada

> **Desde a 003** ([documentos periódicos](../003-documentos-periodicos/spec.md)): tipos podem ser periódicos (um envio por período, com prazo e atraso); esta regra vale para cada período.

```text
Documento geral      = (empresa, tipo GERAL ativo)                 envios: obra_id is null
Documento da obra    = (obra, empresa, tipo POR_OBRA marcado)      envios: obra_id = obra

Exigido (geral)      ⇔ empresa ativa ∧ tipo ativo
Exigido (da obra)    ⇔ empresa ativa ∧ vínculo ativo ∧ obra ativa ∧ tipo ativo ∧ tipo marcado na obra

situação  = RegraSituacaoDocumento.De(envios do documento)          (igual à 001)
podeEnviar = situação ∈ {PENDENTE_ENVIO, REJEITADO} ∧ exigido
```

- **Contagem geral** (`ContagemDocumentos` em empresa): `total` = nº de tipos **GERAL** ativos.
- **Contagem da obra** (por empresa numa obra): `total` = nº de tipos marcados ativos na obra.
- **Empresa com pendência**: pendente/rejeitado em algum documento geral **ou** em algum documento da obra exigido.
- **Obra com pendência**: obra ativa com alguma empresa ativa (vínculo ativo) com documento da obra pendente ou
  rejeitado.
- Envio `EM_ANALISE` pode ser decidido mesmo que o documento deixe de ser exigido (FR-231).

## 6. Auditoria — ações novas

| Ação | recurso_tipo | recurso_id |
|---|---|---|
| `TIPO_ABRANGENCIA_ALTERADA` | `TIPO_DOCUMENTO` | id do tipo |
| `OBRA_TIPO_MARCADO` / `OBRA_TIPO_DESMARCADO` | `OBRA` | `{obraId:N}:{tipoId:N}` |
| `VINCULO_ENCERRADO` / `VINCULO_REABERTO` | `VINCULO` | `{obraId:N}:{empresaId:N}` |

Só registra quando há mudança de fato (marcar já marcado, encerrar já encerrado: sem registro).

## 7. Erros novos (`code`)

| code | HTTP | Quando |
|---|---|---|
| `ABRANGENCIA_IMUTAVEL` | 409 | troca de abrangência de tipo com envios |
| `TIPO_NAO_E_POR_OBRA` | 400 | marcar tipo `GERAL` como exigido de obra |

Rotas de obra no portal com obra/tipo fora do alcance da empresa: 404 `NAO_ENCONTRADO` (sem código novo).
