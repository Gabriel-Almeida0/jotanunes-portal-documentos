# Data Model — 003 Documentos periódicos (mudanças sobre 001/002)

Migration EF nova: **`DocumentosPeriodicos`**.

## 1. Tipo de documento (`tipos_documento`) — alterado

| Campo | Tipo | Regras |
|---|---|---|
| periodicidade_unidade | varchar(10) | `UNICA` \| `MESES` \| `DIAS`; not null default `UNICA`; check |
| periodicidade_intervalo | int null | null se `UNICA`; MESES 1–24; DIAS 1–365 (check) |
| prazo_dias | int null | null se `UNICA`; 0–90 (check) |
| cobranca_desde | timestamptz | not null; migration preenche com `criado_em`; = agora ao reativar o tipo ou ao passar de `UNICA` para periódico |

- Tipos existentes: `UNICA` (FR-302). Catálogo padrão: `UNICA`.
- Mudar unidade/intervalo com envios → 409 `PERIODICIDADE_IMUTAVEL`. `prazo_dias` muda sempre.

## 2. Envio (`envios_documento`) — alterado

| Campo | Tipo | Regras |
|---|---|---|
| periodo_inicio | date null | null ⇔ tipo `UNICA` |
| periodo_fim | date null | null ⇔ tipo `UNICA`; ≥ periodo_inicio |
| enviado_com_atraso | bool | not null default false; `enviado_em` (data em America/Sao_Paulo) > `periodo_fim + prazo_dias` no momento do envio |

- Índice vivo recriado: `ix_envios_documento_vivo (empresa_id, tipo_documento_id, obra_id, periodo_inicio) NULLS NOT
  DISTINCT WHERE status <> 'REJEITADO'`.
- Índice: `(empresa_id, tipo_documento_id, obra_id, periodo_inicio, enviado_em desc) WHERE periodo_inicio is not null`.

## 3. Período (derivado)

```text
inicioCobranca  geral   = max(empresa.criado_em, tipo.cobranca_desde)
                por obra= max(vinculo.vinculado_em, marcacao.marcado_em, tipo.cobranca_desde)
                (datas convertidas para America/Sao_Paulo)

MESES/N: p0.inicio = 1º dia do mês de inicioCobranca; pk.inicio = p0.inicio + k·N meses; pk.fim = pk+1.inicio − 1 dia
DIAS/N : p0.inicio = data de inicioCobranca;           pk.inicio = p0.inicio + k·N dias;  pk.fim = pk.inicio + N − 1
períodos exigidos = p0 … pk onde pk.inicio ≤ hoje   (inclui o período em curso)
prazo(pk)        = pk.fim + prazo_dias

situação(pk)     = RegraSituacaoDocumento.De(envios com periodo_inicio = pk.inicio)
atrasado(pk)     = hoje > prazo(pk) ∧ situação ∈ {PENDENTE_ENVIO, REJEITADO}
podeEnviar(pk)   = situação ∈ {PENDENTE_ENVIO, REJEITADO} ∧ documento exigido
```

Situação resumida do documento periódico (FR-312), prioridade: **algum atrasado** → a situação desse período
(PENDENTE_ENVIO ou REJEITADO) com `atrasado = true`; senão REJEITADO > PENDENTE_ENVIO > EM_ANALISE > APROVADO.
Documento periódico sem nenhum período exigido ainda (não acontece: o período em curso sempre existe) — n/a.

Contagem: o documento entra uma vez em `ContagemDocumentos` pela situação resumida; `periodosAtrasados` = soma dos
períodos atrasados. Empresa com pendência: inclui período pendente, rejeitado ou atrasado (FR-321).

## 4. Auditoria

| Ação | recurso_tipo | quando |
|---|---|---|
| `TIPO_PERIODICIDADE_ALTERADA` | `TIPO_DOCUMENTO` | unidade, intervalo ou prazo mudaram |

## 5. Erros novos

| code | HTTP | Quando |
|---|---|---|
| `PERIODICIDADE_IMUTAVEL` | 409 | mudar unidade/intervalo de tipo com envios |
| `PERIODO_OBRIGATORIO` | 400 | envio de tipo periódico sem `periodoInicio`, ou de tipo único com `periodoInicio` |

Período que não é exigido (futuro, antes do início, data que não é início de período) → 404 `NAO_ENCONTRADO`.
