# Data Model — Portal de Documentação de Terceirizadas Jotanunes

**Feature**: `001-portal-documentos-terceirizadas` | **Banco**: PostgreSQL 16 | **ORM**: EF Core 8
(snake_case) | **Contrato**: [`contracts/openapi.yaml`](contracts/openapi.yaml)

Convenções: PK `id uuid` (gerado na aplicação), datas `timestamptz` em UTC, textos `varchar(n)`.
Colunas de autoria guardam o **login Fluig** (`*_por_login`) e o **nome** (`*_por_nome`) como texto,
pois os usuários vivem no Fluig (não há tabela de usuários Jotanunes).

## Diagrama

```text
obras 1───* obra_empresas *───1 empresas 1───* convites
                                   │
                                   1
                                   │
tipos_documento 1───────* envios_documento *───(1 empresa)
auditoria (independente)
tentativas_login (independente; chave derivada do CNPJ digitado)
```

---

## 1. Obra (`obras`)

| Campo | Tipo | Regras |
|---|---|---|
| id | uuid PK | |
| nome | varchar(150) | obrigatório, 3–150, trim |
| codigo | varchar(30) null | opcional; único case-insensitive (`upper(codigo)`) quando preenchido |
| cidade | varchar(100) | obrigatório |
| uf | char(2) | obrigatório, uma das 27 UFs, maiúsculas |
| ativa | bool | padrão `true` |
| criado_em / criado_por_login | timestamptz / varchar(100) | |
| atualizado_em / atualizado_por_login | timestamptz null / varchar(100) null | |

Obra inativa não aparece nos filtros padrão, mas vínculos e histórico continuam.

## 2. Empresa (`empresas`)

| Campo | Tipo | Regras |
|---|---|---|
| id | uuid PK | |
| razao_social | varchar(200) | obrigatório, 2–200 |
| nome_fantasia | varchar(200) null | |
| cnpj | char(14) UNIQUE | normalizado (sem máscara, maiúsculas), DV válido (numérico ou alfanumérico — research R9); **imutável após o 1º convite** |
| email_contato | varchar(254) | obrigatório, e-mail válido, minúsculas |
| nome_contato | varchar(150) null | |
| telefone | varchar(20) null | só dígitos, 10–11 |
| ativa | bool | padrão `true` |
| senha_hash | varchar(100) null | BCrypt; null até o 1º convite |
| troca_senha_obrigatoria | bool | `true` após cada convite; `false` após troca |
| senha_temporaria_expira_em | timestamptz null | = expiração do convite vigente; null após troca |
| versao_credencial | int | começa em 0; +1 em convite, troca de senha e desativação (revoga tokens) |
| tentativas_falhas | int | zera no sucesso |
| bloqueado_ate | timestamptz null | agora + 15 min ao atingir 5 falhas |
| ultimo_acesso_em | timestamptz null | |
| criado_em / criado_por_login / atualizado_em / atualizado_por_login | | |

### Situação de acesso (derivada, não persistida)

```text
ativa = false                                                  → DESATIVADA
nenhum convite                                                 → NAO_CONVIDADA
troca_senha_obrigatoria = true  e senha_temporaria_expira_em > agora → CONVIDADA
troca_senha_obrigatoria = true  e senha_temporaria_expira_em ≤ agora → CONVITE_EXPIRADO
troca_senha_obrigatoria = false                                → ATIVA
```

## 3. Vínculo obra–empresa (`obra_empresas`)

| Campo | Tipo | Regras |
|---|---|---|
| obra_id | uuid FK → obras | PK composta (obra_id, empresa_id) |
| empresa_id | uuid FK → empresas | |
| vinculado_em / vinculado_por_login | timestamptz / varchar(100) | |

Vincular de novo é idempotente (204). Desvincular remove a linha (não afeta documentos — decisão do
clarify: documentos são por empresa).

## 4. Tipo de documento (`tipos_documento`)

| Campo | Tipo | Regras |
|---|---|---|
| id | uuid PK | |
| nome | varchar(120) | obrigatório, 3–120, único case-insensitive (`lower(nome)`) |
| instrucoes | varchar(1000) null | texto exibido para a empresa |
| ativo | bool | padrão `true` |
| criado_em / criado_por_login / atualizado_em / atualizado_por_login | | |

Regra (clarify): **todo tipo ativo é exigido de toda empresa ativa**. Não há tabela de exigência por
empresa.

## 5. Convite (`convites`)

| Campo | Tipo | Regras |
|---|---|---|
| id | uuid PK | |
| empresa_id | uuid FK → empresas | índice |
| email_destino | varchar(254) | cópia do e-mail no momento do envio |
| token_hash | char(64) UNIQUE | SHA-256 hex do token (o token nunca é guardado) |
| enviado_em | timestamptz | |
| enviado_por_login / enviado_por_nome | varchar(100) / varchar(150) | usuário Fluig |
| expira_em | timestamptz | enviado_em + 7 dias |
| usado_em | timestamptz null | preenchido na 1ª troca de senha |
| substituido_em | timestamptz null | preenchido quando um novo convite é enviado |

**Situação do convite** (derivada): `USADO` se `usado_em`; `SUBSTITUIDO` se `substituido_em`;
`EXPIRADO` se `expira_em ≤ agora`; senão `VALIDO`. Só um convite `VALIDO` por empresa.

## 6. Envio de documento (`envios_documento`)

| Campo | Tipo | Regras |
|---|---|---|
| id | uuid PK | |
| empresa_id | uuid FK → empresas | |
| tipo_documento_id | uuid FK → tipos_documento | |
| nome_arquivo | varchar(255) | nome original saneado (sem caminho) |
| content_type | varchar(50) | detectado: `application/pdf`, `image/jpeg`, `image/png` |
| tamanho_bytes | bigint | 1 – 10.485.760 |
| sha256 | char(64) | |
| chave_armazenamento | varchar(300) | `empresas/{empresaId:N}/{id:N}`; nunca exposta na API |
| enviado_em | timestamptz | |
| status | varchar(20) | `EM_ANALISE` → `APROVADO` \| `REJEITADO` |
| analisado_em | timestamptz null | |
| analisado_por_login / analisado_por_nome | varchar(100) null / varchar(150) null | |
| motivo_rejeicao | varchar(500) null | obrigatório (5–500, trim) se `REJEITADO`; null caso contrário |

Índices: `(empresa_id, tipo_documento_id, enviado_em desc)`; `(status, enviado_em)` para a fila;
**único parcial** `(empresa_id, tipo_documento_id) WHERE status <> 'REJEITADO'`.

### Máquina de estados do envio

```text
          (empresa envia)          (analista aprova)
  ──────────────► EM_ANALISE ─────────────────────► APROVADO   (final)
                      │
                      │ (analista rejeita + motivo)
                      ▼
                  REJEITADO (final)  ── empresa envia NOVO envio ──► EM_ANALISE (outro registro)
```

- Transições só a partir de `EM_ANALISE`; `APROVADO` e `REJEITADO` são imutáveis.
- Um novo envio para (empresa, tipo) só é permitido se não existir envio `EM_ANALISE` ou `APROVADO`
  para o par (garantido pelo índice parcial).
- Tipo de documento inativo: não aceita novos envios; envios `EM_ANALISE` ainda podem ser analisados.

### Situação do documento (derivada por empresa × tipo ativo)

```text
existe envio não rejeitado  → status desse envio (EM_ANALISE | APROVADO)
senão existe envio rejeitado → REJEITADO (+ motivo do mais recente)
senão                        → PENDENTE_ENVIO
podeEnviar = situação ∈ {PENDENTE_ENVIO, REJEITADO} e empresa ativa e tipo ativo
```

**Contagem de documentos** (por empresa): `total` = nº de tipos ativos; `pendentes`, `emAnalise`,
`aprovados`, `rejeitados` pela regra acima. "Empresa com pendência" = `pendentes + rejeitados > 0`.

## 7. Auditoria (`auditoria`)

| Campo | Tipo | Regras |
|---|---|---|
| id | bigint identity PK | |
| ocorrido_em | timestamptz | |
| ator_tipo | varchar(10) | `FLUIG` \| `EMPRESA` \| `ANONIMO` |
| ator_id | varchar(100) null | login Fluig, id da empresa ou CNPJ informado (falha de login) |
| acao | varchar(40) | ver research R12 |
| recurso_tipo / recurso_id | varchar(40) null / varchar(100) null | |
| ip | varchar(45) null | |

Nunca contém senha, token ou conteúdo de arquivo.

## 8. Tentativas de login por CNPJ (`tentativas_login`)

Contador de falhas para CNPJ informado no login que **não** corresponde a uma empresa com senha
(CNPJ inexistente, inválido ou empresa nunca convidada). Aplica a mesma regra de `empresas`
(5 falhas seguidas → `bloqueado_ate = agora + 15 min`, contador volta a 0), para que a sequência
401×5 → 423 seja igual à de um CNPJ existente (FR-006, FR-062). Empresas com senha continuam usando
`empresas.tentativas_falhas`/`bloqueado_ate`.

| Campo | Tipo | Regras |
|---|---|---|
| chave | char(64) PK | HMAC-SHA256 hex do CNPJ normalizado, com chave derivada de `Auth__Portal__Secret`; o CNPJ digitado não é guardado aqui |
| tentativas_falhas | int | falhas seguidas desde o último bloqueio |
| bloqueado_ate | timestamptz null | agora + 15 min ao atingir 5 falhas |
| ultima_falha_em | timestamptz null | |

Linha criada na 1ª falha (`INSERT … ON CONFLICT DO NOTHING`, seguro sob concorrência). Sem limpeza
automática na v1: linhas com `tentativas_falhas = 0` e `bloqueado_ate` vencido equivalem a "sem
linha" e podem ser apagadas a qualquer momento sem mudar o comportamento. Trocar o segredo do portal
apenas zera esses contadores.

## Mapeamento para a API

| Entidade | Schemas no contrato |
|---|---|
| Obra | `Obra`, `ObraResumo`, `ObraDetalhe`, `ObraInput`, `ObraAtualizacao` |
| Empresa | `Empresa`, `EmpresaResumo`, `EmpresaInput`, `EmpresaAtualizacao`, `EmpresaPortal`, `SituacaoAcesso` |
| Vínculo | `EmpresaNaObra`, `ObraRef` |
| Tipo de documento | `TipoDocumento`, `TipoDocumentoInput`, `TipoDocumentoAtualizacao`, `TipoDocumentoRef` |
| Convite | `Convite`, `ConviteValidacao`, `SituacaoConvite` |
| Envio | `Envio`, `EnvioFila`, `EnvioPortal`, `StatusEnvio`, `Rejeicao` |
| Situação do documento | `DocumentoSituacao`, `DocumentoSituacaoPortal`, `SituacaoDocumento`, `ContagemDocumentos` |
