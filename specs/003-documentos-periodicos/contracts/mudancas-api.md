# Mudanças no contrato da API — 1.3.0 → 1.4.0

Contrato único: [`001/contracts/openapi.yaml`](../../001-portal-documentos-terceirizadas/contracts/openapi.yaml).
Operações: 52 → **56**.

## Schemas novos

```yaml
UnidadePeriodicidade: { type: string, enum: [UNICA, MESES, DIAS] }

Periodicidade:
  required: [unidade]
  unidade: UnidadePeriodicidade
  intervalo: integer nullable   # null se UNICA; MESES 1–24; DIAS 1–365
  prazoDias: integer nullable   # null se UNICA; 0–90
  descricao: string (readOnly, só em respostas) # ex.: "Mensal · até o dia 15 do mês seguinte"

PeriodoRef:                      # período a que um envio se refere
  required: [inicio, fim, rotulo]
  inicio: date, fim: date, rotulo: string   # "Março/2026"

ResumoPeriodos:                  # em DocumentoSituacao(+Portal) quando o tipo é periódico
  required: [atrasados, pendentes, rejeitados, emAnalise, aprovados]
  (inteiros ≥ 0)
  proximo: PeriodoComPrazo nullable  # primeiro período (mais antigo) que pede ação; null se nenhum

PeriodoComPrazo:
  allOf: PeriodoRef + { required: [prazo], prazo: date }

Periodo:                         # visão Jotanunes (GET …/periodos)
  allOf: PeriodoComPrazo + { required: [situacao, atrasado, quantidadeEnvios],
    situacao: SituacaoDocumento, atrasado: boolean, envioAtual: Envio nullable, quantidadeEnvios: integer }

PeriodoPortal:                   # visão empresa
  allOf: PeriodoComPrazo + { required: [situacao, atrasado, podeEnviar],
    situacao: SituacaoDocumento, atrasado: boolean, envioAtual: EnvioPortal nullable, podeEnviar: boolean }
```

## Schemas alterados

| Schema | Mudança |
|---|---|
| `TipoDocumentoInput` | + `periodicidade: Periodicidade` (opcional; omitido = UNICA) |
| `TipoDocumento`, `TipoDocumentoRef` | + `periodicidade` (required) |
| `DocumentoSituacao`, `DocumentoSituacaoPortal` | + `atrasado: boolean` (required); + `periodos: ResumoPeriodos` (nullable; null para único). Para periódico, `situacao`/`envioAtual` refletem o período resumido (data-model §3) |
| `ContagemDocumentos` | + `periodosAtrasados: integer` (required) |
| `Envio`, `EnvioPortal` | + `periodo: PeriodoRef` nullable; + `enviadoComAtraso: boolean` (required) |
| `Painel` | + `empresasComAtraso: integer` |
| `CodigoErro` | + `PERIODICIDADE_IMUTAVEL`, `PERIODO_OBRIGATORIO` |

## Rotas alteradas

| Rota | Mudança |
|---|---|
| `GET /tipos-documento` | + query `periodico: boolean` |
| `PUT /tipos-documento/{t}` | aceita `periodicidade`; + 409 `PERIODICIDADE_IMUTAVEL` |
| `GET /empresas` | + query `comAtraso: boolean` |
| `GET /envios` | + query `comAtraso: boolean` (envios com `enviadoComAtraso`) |
| `POST /portal/documentos/{t}/envios`, `POST /portal/obras/{o}/documentos/{t}/envios` | multipart + campo `periodoInicio` (date; obrigatório p/ periódico, proibido p/ único) → 400 `PERIODO_OBRIGATORIO`; período não exigido → 404 |
| `GET` históricos de envios (portal e fluig, gerais e por obra) | + query `periodoInicio` (date, opcional): só os envios daquele período |

## Rotas novas (4)

| Método e rota | operationId | Auth | Resposta |
|---|---|---|---|
| `GET /fluig/empresas/{empresaId}/documentos/{tipoDocumentoId}/periodos` | `fluigListarPeriodosEmpresa` | fluig | `200 Periodo[]` (mais recente primeiro); 404 se tipo não for geral periódico |
| `GET /fluig/obras/{obraId}/empresas/{empresaId}/documentos/{tipoDocumentoId}/periodos` | `fluigListarPeriodosEmpresaObra` | fluig | `200 Periodo[]`; 404 sem vínculo / tipo não marcado ou único |
| `GET /portal/documentos/{tipoDocumentoId}/periodos` | `portalListarPeriodos` | portal | `200 PeriodoPortal[]`; 404 |
| `GET /portal/obras/{obraId}/documentos/{tipoDocumentoId}/periodos` | `portalListarPeriodosObra` | portal | `200 PeriodoPortal[]`; 404 (mesmas regras de isolamento da 002 R8) |
