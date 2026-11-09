# Mudanças no contrato da API — 1.2.0 → 1.3.0

O contrato continua **único**: [`001/contracts/openapi.yaml`](../../001-portal-documentos-terceirizadas/contracts/openapi.yaml)
(research R1). Este documento lista o que a 002 muda nele. As rotas são relativas a `/api/fluig` e `/api/portal`.
Operações: 43 → **52**.

## Schemas

### Novos

```yaml
Abrangencia:
  type: string
  enum: [GERAL, POR_OBRA]
  description: GERAL = da empresa, vale em todas as obras. POR_OBRA = cada obra exige e recebe o seu envio.

TipoExigidoObra:            # item de GET /obras/{obraId}/tipos-documento
  required: [tipoDocumento, exigido]
  tipoDocumento: TipoDocumento          # só POR_OBRA, ativos e inativos marcados
  exigido: boolean
  marcadoEm: date-time, nullable

VinculoEncerrado:           # ObraDetalhe.vinculosEncerrados[]
  required: [empresaId, razaoSocial, cnpj, encerradoEm, quantidadeEnvios]
  empresaId, razaoSocial, cnpj, encerradoEm (date-time), encerradoPorLogin (nullable), quantidadeEnvios (int ≥ 0)

ObraNaEmpresa:              # Empresa.obras[] (substitui ObraRef nesse uso)
  allOf: ObraRef + { required: [vinculoAtivo, obraAtiva, documentos], vinculoAtivo: boolean, obraAtiva: boolean,
                     documentos: ContagemDocumentos }   # contagem dos documentos DA OBRA para esta empresa

ObraPortal:                 # GET /portal/obras
  allOf: ObraRef + { required: [documentos], documentos: ContagemDocumentos }
```

### Alterados

| Schema | Mudança |
|---|---|
| `TipoDocumentoInput` | + `abrangencia: Abrangencia` (**required**) |
| `TipoDocumento`, `TipoDocumentoRef` | + `abrangencia` (required) |
| `ContagemDocumentos.total` | descrição: "Documentos exigidos no contexto (tipos GERAL ativos na empresa; tipos marcados e ativos na obra)" |
| `EmpresaResumo` | + `documentosObra: ContagemDocumentos` (nullable; preenchido só quando a lista foi filtrada por `obraId`). `documentos` passa a ser **só gerais** |
| `Empresa.obras` | itens viram `ObraNaEmpresa` (inclui vínculos encerrados, com `vinculoAtivo=false`) |
| `EmpresaNaObra` | `documentos` → renomeado `documentosObra` (contagem da obra); + `documentosGerais: ContagemDocumentos`; + `quantidadeEnviosNaObra: integer` (para a confirmação de desvincular) |
| `ObraDetalhe` | `empresas` = só vínculos ativos; + `vinculosEncerrados: VinculoEncerrado[]`; + `quantidadeTiposExigidos: integer` |
| `ObraResumo` | + `quantidadeTiposExigidos: integer` |
| `Painel` | + `obrasComPendencia: integer`; descrição de `empresasComPendencia` inclui documentos da obra |
| `Envio` | + `obraId: uuid nullable` |
| `EnvioFila` | + `obra: ObraRef nullable` (null = geral) |
| `EnvioPortal` | + `obraId: uuid nullable` |
| `CodigoErro` | + `ABRANGENCIA_IMUTAVEL`, `TIPO_NAO_E_POR_OBRA` |

## Rotas alteradas

| Rota | Mudança |
|---|---|
| `GET /tipos-documento` | + query `abrangencia` (opcional) |
| `PUT /tipos-documento/{t}` | aceita `abrangencia`; + `409 ABRANGENCIA_IMUTAVEL` |
| `GET /obras` | + query `comPendencia: boolean` |
| `PUT /obras/{o}/empresas/{e}` | summary: "Vincula ou reabre o vínculo (idempotente)" |
| `DELETE /obras/{o}/empresas/{e}` | summary: "Encerra o vínculo (histórico preservado)"; 204 também se já encerrado |
| `GET /empresas/{e}/documentos` | descrição: **só documentos gerais** |
| `GET /empresas/{e}/documentos/{t}/envios` | só envios gerais; tipo `POR_OBRA` → 404 |
| `GET /envios` | `obraId` passa a significar "envios **desta obra**"; + query `somenteGerais: boolean` (não combina com `obraId`: 400) |
| `GET /portal/documentos` | **só documentos gerais** |
| `GET\|POST /portal/documentos/{t}/envios` | só tipo `GERAL`; tipo `POR_OBRA` → 404 |
| `GET /portal/envios/{id}/arquivo` | envio de obra exige vínculo ativo e obra ativa; senão 404 |

## Rotas novas (9)

Área Jotanunes (`fluigAuth`):

| Método e rota | operationId | admin | Resposta |
|---|---|---|---|
| `GET /obras/{obraId}/tipos-documento` | `fluigListarTiposExigidosObra` | não | `200 TipoExigidoObra[]` (todos os tipos POR_OBRA ativos + inativos marcados, por nome); 404 |
| `PUT /obras/{obraId}/tipos-documento/{tipoDocumentoId}` | `fluigMarcarTipoExigidoObra` | **sim** | 204; 400 `TIPO_NAO_E_POR_OBRA`; 404 |
| `DELETE /obras/{obraId}/tipos-documento/{tipoDocumentoId}` | `fluigDesmarcarTipoExigidoObra` | **sim** | 204 (idempotente); 404 obra/tipo inexistente |
| `GET /obras/{obraId}/empresas/{empresaId}/documentos` | `fluigListarDocumentosEmpresaObra` | não | `200 DocumentoSituacao[]` (tipos marcados; com vínculo encerrado também responde, para histórico); 404 sem vínculo (ativo ou encerrado) |
| `GET /obras/{obraId}/empresas/{empresaId}/documentos/{tipoDocumentoId}/envios` | `fluigListarHistoricoEnviosEmpresaObra` | não | `200 Envio[]` (mais recente primeiro; inclui envios de tipo desmarcado); 404 |

Portal (`portalAuth`) — `{obraId}` resolvido só entre obras ativas com vínculo ativo da empresa do token (R8):

| Método e rota | operationId | Resposta |
|---|---|---|
| `GET /obras` | `portalListarObras` | `200 ObraPortal[]` (obras ativas com vínculo ativo; ordem: com pendência primeiro, depois nome) |
| `GET /obras/{obraId}/documentos` | `portalListarDocumentosObra` | `200 DocumentoSituacaoPortal[]`; 404 |
| `GET /obras/{obraId}/documentos/{tipoDocumentoId}/envios` | `portalListarHistoricoObra` | `200 EnvioPortal[]`; 404 |
| `POST /obras/{obraId}/documentos/{tipoDocumentoId}/envios` | `portalEnviarDocumentoObra` | igual a `POST /documentos/{t}/envios` (multipart `arquivo`; 201 `EnvioPortal`; 400/409/413/415); 404 |

Os novos `PUT`/`DELETE` de tipos exigidos entram em `ExigemAdmin` no `PerfilAdminTests`; o `POST` do portal não é
rota Fluig.
