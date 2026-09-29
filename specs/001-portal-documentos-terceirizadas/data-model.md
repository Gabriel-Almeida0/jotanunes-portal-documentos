# Data Model — Portal de Documentação de Terceirizadas Jotanunes

**Feature**: `001-portal-documentos-terceirizadas` | **Banco**: PostgreSQL 16 | **ORM**: EF Core 8
(snake_case) | **Contrato**: [`contracts/openapi.yaml`](contracts/openapi.yaml)

Convenções: PK `id uuid` (gerado na aplicação), datas `timestamptz` em UTC, textos `varchar(n)`.
Colunas de autoria guardam o **login** do usuário da área Jotanunes (`*_por_login`) e o **nome**
(`*_por_nome`) como texto, sem chave estrangeira: o usuário pode vir do Fluig (sem cadastro no
sistema) ou, desde 2026-09-29, ser um usuário interno do login próprio (§10), ou `sistema`.

## Diagrama

```text
obras 1───* obra_empresas *───1 empresas 1───* convites
                                   │
                                   1
                                   │
tipos_documento 1───────* envios_documento *───(1 empresa)
auditoria (independente)
tentativas_login (independente; chave derivada do CNPJ ou do login digitado)
usuarios_internos (independente; login próprio da área Jotanunes, §10)
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

Regra (clarify, **validada** em 2026-09-29): **todo tipo ativo é exigido de toda empresa ativa**.
Não há tabela de exigência por empresa.

Escrita (criar, editar, ativar/desativar) só por **administrador** (§9); leitura por qualquer
usuário Fluig.

### 4.1 Catálogo padrão (FR-090–FR-093)

Criado pelo semeador de inicialização (research R15) **somente se `tipos_documento` estiver vazia**
(nenhuma linha, ativa ou inativa). Todos `ativo = true`, `criado_por_login = 'sistema'`,
`criado_em` = instante da criação. Nomes respeitam 3–120 caracteres e a unicidade `lower(nome)`;
instruções ≤ 1000 caracteres. Esta tabela é a fonte do texto usado no código
(`CatalogoTiposPadrao` na `Application`).

| # | nome | instrucoes |
|---|---|---|
| 1 | Cartão CNPJ | Envie o comprovante de inscrição e situação cadastral do CNPJ, emitido no site da Receita Federal, com data de emissão recente. |
| 2 | Contrato Social e última alteração | Envie o contrato social e a última alteração contratual (ou a consolidação), com o registro na Junta Comercial. |
| 3 | CND Federal (Receita Federal/PGFN) | Envie a certidão de débitos relativos a tributos federais e à dívida ativa da União, emitida no site da Receita Federal e dentro da validade. |
| 4 | CND Estadual | Envie a certidão negativa de débitos estaduais, emitida pela Secretaria da Fazenda do estado da sede da empresa e dentro da validade. |
| 5 | CND Municipal | Envie a certidão negativa de débitos municipais, emitida pela prefeitura da cidade da sede da empresa e dentro da validade. |
| 6 | CRF do FGTS | Envie o Certificado de Regularidade do FGTS (CRF), emitido no site da Caixa e dentro da validade. |
| 7 | CNDT (Certidão Negativa de Débitos Trabalhistas) | Envie a CNDT emitida no site do Tribunal Superior do Trabalho (TST), dentro da validade. |
| 8 | PGR (Programa de Gerenciamento de Riscos) | Envie o PGR vigente da empresa, com o inventário de riscos e o plano de ação, assinado pelo responsável. |
| 9 | PCMSO (Programa de Controle Médico de Saúde Ocupacional) | Envie o PCMSO vigente, assinado pelo médico do trabalho responsável. |
| 10 | ART/RRT | Envie a ART (CREA) ou o RRT (CAU) do responsável técnico pelos serviços contratados, com o comprovante de pagamento. |

Validade/vencimento dos documentos continua fora do escopo (spec, Assumptions): "dentro da
validade" é só orientação para a empresa.

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
| ator_tipo | varchar(10) | `FLUIG` \| `LOCAL` \| `EMPRESA` \| `ANONIMO` \| `SISTEMA` (`LOCAL` e `SISTEMA` desde o login próprio, §10) |
| ator_id | varchar(100) null | login Fluig, login do usuário interno, id da empresa, CNPJ informado (falha de login do portal), login informado (falha de login próprio, só se tiver o formato de login; senão null) ou `sistema` |
| ator_admin | bool null | **novo (2026-09-29)**: só para `ator_tipo = FLUIG` ou `LOCAL` — `true` se a sessão tinha o papel `admin`, `false` se comum; `null` para `EMPRESA`/`ANONIMO`/`SISTEMA` e para linhas anteriores à mudança |
| acao | varchar(40) | ver research R12 (inclui `PERMISSAO_NEGADA`) |
| recurso_tipo / recurso_id | varchar(40) null / varchar(100) null | |
| ip | varchar(45) null | |

Nunca contém senha, token ou conteúdo de arquivo.

`PERMISSAO_NEGADA` (FR-085): gravada quando um usuário comum chama uma operação de administrador;
`ator_admin = false`, `recurso_tipo = 'OPERACAO'`, `recurso_id` = `operationId` do contrato (ex.:
`fluigCriarObra`). Coluna nova via migration `PerfilAdminAuditoria` (nullable, sem backfill).

Login próprio (§10): `LOGIN_SUCESSO`, `LOGIN_FALHA`, `LOGIN_BLOQUEADO`, `SENHA_TROCADA` com
`recurso_tipo = 'USUARIO_INTERNO'` e `recurso_id` = id do usuário (null quando o login não existe);
ações novas `USUARIO_CRIADO`, `USUARIO_ATUALIZADO` (nome, e-mail ou papel), `USUARIO_DESATIVADO`,
`USUARIO_REATIVADO`, `SENHA_REDEFINIDA`, `SESSAO_ENCERRADA` (sair), todas com
`recurso_tipo = 'USUARIO_INTERNO'`. Quando o caso de uso registra `FLUIG` numa sessão de login próprio,
o adaptador grava `LOCAL` (a porta `IRegistroAuditoria` não muda). Nenhuma coluna nova (os textos
cabem em `varchar(10)`/`varchar(40)`).

## 8. Tentativas de login por CNPJ (`tentativas_login`)

Contador de falhas para CNPJ informado no login que **não** corresponde a uma empresa com senha
(CNPJ inexistente, inválido ou empresa nunca convidada). Aplica a mesma regra de `empresas`
(5 falhas seguidas → `bloqueado_ate = agora + 15 min`, contador volta a 0), para que a sequência
401×5 → 423 seja igual à de um CNPJ existente (FR-006, FR-062). Empresas com senha continuam usando
`empresas.tentativas_falhas`/`bloqueado_ate`.

| Campo | Tipo | Regras |
|---|---|---|
| chave | char(64) PK | HMAC-SHA256 hex do CNPJ normalizado, com chave derivada de `Auth__Portal__Secret`; ou, para o login próprio (§10), de `"usuario:" + login normalizado` com chave derivada de `Auth__LoginLocal__Secret` e rótulo próprio. O CNPJ/login digitado não é guardado aqui |
| tentativas_falhas | int | falhas seguidas desde o último bloqueio |
| bloqueado_ate | timestamptz null | agora + 15 min ao atingir 5 falhas |
| ultima_falha_em | timestamptz null | |

Linha criada na 1ª falha (`INSERT … ON CONFLICT DO NOTHING`, seguro sob concorrência). Sem limpeza
automática na v1: linhas com `tentativas_falhas = 0` e `bloqueado_ate` vencido equivalem a "sem
linha" e podem ser apagadas a qualquer momento sem mudar o comportamento. Trocar o segredo do portal
apenas zera esses contadores.

Login próprio (§10): login digitado que **não** corresponde a um usuário interno usa esta mesma
tabela com a mesma regra, para que a sequência 401×5 → 423 seja igual à de um login existente
(FR-104). Usuários internos existentes usam `usuarios_internos.tentativas_falhas`/`bloqueado_ate`.

## 9. Perfil do usuário Fluig (não persistido)

~~Não há tabela de usuários nem de papéis.~~ (2026-09-29: os usuários do Fluig continuam sem
cadastro; os usuários internos do login próprio estão em §10 e seguem a mesma tabela de permissões
abaixo, com o papel vindo da coluna `admin`.) O perfil de quem entra pelo Fluig é lido do token Fluig
a cada requisição (`contracts/fluig-identity.md`):

```text
roles contém "admin" (lista, ou texto único "admin") → ADMINISTRADOR
qualquer outro caso (ausente, vazia, sem "admin", tipo inesperado) → COMUM
```

| Ação | Administrador | Comum |
|---|---|---|
| Consultar painel, listas, detalhes, situação/histórico de documentos, convites | ✅ | ✅ |
| Abrir/baixar arquivo de envio | ✅ | ✅ |
| Enviar/reenviar convite | ✅ | ✅ |
| Criar/editar/ativar/desativar obra; vincular/desvincular empresa | ✅ | ❌ 403 `SEM_PERMISSAO` |
| Criar/editar/ativar/desativar empresa | ✅ | ❌ 403 `SEM_PERMISSAO` |
| Criar/editar/ativar/desativar tipo de documento | ✅ | ❌ 403 `SEM_PERMISSAO` |
| Aprovar/rejeitar envio | ✅ | ❌ 403 `SEM_PERMISSAO` |
| Listar/ver/criar/editar/ativar/desativar usuários internos e redefinir senha (§10) | ✅ | ❌ 403 `SEM_PERMISSAO` |

As colunas de autoria já existentes (`criado_por_login`, `atualizado_por_login`,
`vinculado_por_login`, `analisado_por_login`) continuam iguais: depois desta mudança, só guardam
logins de administradores (ou `sistema`, no catálogo padrão).

## 10. Usuário interno (`usuarios_internos`) — login próprio da área Jotanunes (2026-09-29)

Colaborador da Jotanunes que entra na área Jotanunes com login + senha (research R17). Não se liga aos
usuários do Fluig.

| Campo | Tipo | Regras |
|---|---|---|
| id | uuid PK | |
| login | varchar(100) | obrigatório; `trim` + minúsculas; formato `^[a-z0-9._-]{3,100}$`; **único** (`lower(login)`, índice único); **imutável** |
| nome | varchar(150) | obrigatório, 3–150, trim |
| email | varchar(254) | obrigatório, e-mail válido, minúsculas (value object `Email`); não precisa ser único |
| admin | bool | padrão `false` |
| ativo | bool | padrão `true` |
| senha_hash | varchar(100) | BCrypt 12; sempre preenchido (nasce com a senha provisória) |
| troca_senha_obrigatoria | bool | `true` ao criar e a cada redefinição; `false` após a troca |
| senha_provisoria_expira_em | timestamptz null | criação/redefinição + 7 dias; null após a troca |
| versao_credencial | int | começa em 0; +1 ao desativar, reativar, redefinir senha, trocar senha, mudar `admin` e sair (revoga tokens, claim `ver`) |
| tentativas_falhas | int | zera no sucesso e na redefinição |
| bloqueado_ate | timestamptz null | agora + 15 min na 5ª falha seguida; zerado na redefinição |
| ultimo_acesso_em | timestamptz null | |
| criado_em / criado_por_login | timestamptz / varchar(100) | login de quem cadastrou ou `sistema` (comando de instalação) |
| atualizado_em / atualizado_por_login | timestamptz null / varchar(100) null | |

Migration `UsuariosInternos` (tabela + índice único `lower(login)` + índice parcial
`(admin, ativo) WHERE admin AND ativo` para a contagem de administradores).

### Situação do usuário interno (derivada, não persistida)

```text
ativo = false                                                        → DESATIVADO
troca_senha_obrigatoria = true e senha_provisoria_expira_em > agora  → AGUARDANDO_PRIMEIRO_ACESSO
troca_senha_obrigatoria = true e senha_provisoria_expira_em ≤ agora  → SENHA_PROVISORIA_EXPIRADA
troca_senha_obrigatoria = false                                      → ATIVO
```

(O bloqueio temporário por tentativas não é uma situação: aparece como `bloqueadoAte` na API.)

### Regras (FR-100–FR-116)

- **Criar** (administrador ou comando de instalação): gera senha provisória (12 caracteres, R3),
  `troca_senha_obrigatoria = true`, expiração +7 dias; e-mail de acesso (pela tela: gravar → e-mail →
  commit; falha → nada gravado, `EMAIL_ACESSO_FALHOU`). Login repetido → `LOGIN_DUPLICADO`.
- **Atualizar** (`nome`, `email`, `admin`, `ativo`): mudar `admin` ou `ativo` incrementa
  `versao_credencial`. Recusas, nesta ordem: a sessão de login próprio mexendo em si mesma para
  `ativo = false` ou `admin = false` → `ALTERACAO_PROPRIA_NAO_PERMITIDA`; o resultado deixaria **zero**
  usuários com `admin = true AND ativo = true` → `ULTIMO_ADMINISTRADOR` (checado sob bloqueio
  exclusivo, R17).
- **Redefinir senha**: só usuário ativo (`USUARIO_INATIVO` se não); nova senha provisória, troca
  obrigatória, +7 dias, zera tentativas/bloqueio, `versao_credencial + 1`, e-mail (mesma ordem da
  criação).
- **Trocar senha** (o próprio usuário): exige a senha atual (`SENHA_ATUAL_INCORRETA`) e a política
  `PoliticaSenha` (`SENHA_FRACA`); `troca_senha_obrigatoria = false`, expiração null,
  `versao_credencial + 1`, devolve token novo.
- **Login**: ordem e respostas em research R17; falhas e bloqueio como `empresas` (§2).
- **Sair**: `versao_credencial + 1`.
- Nunca é excluído (FR-016). Contagem de administradores ativos ignora o bloqueio temporário.

### Máquina de estados

```text
 (criar / comando)                 (troca de senha)
 ───────────────► AGUARDANDO_PRIMEIRO_ACESSO ─────────────► ATIVO
                        │  ▲ (redefinir senha)                  │
          (7 dias sem   │  └──────────────────────────────────┘
           troca)       ▼
               SENHA_PROVISORIA_EXPIRADA ── (redefinir senha) ──► AGUARDANDO_PRIMEIRO_ACESSO
 qualquer estado ── (desativar) ──► DESATIVADO ── (reativar) ──► estado derivado dos campos de senha
```

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
| Perfil do usuário Fluig | `UsuarioFluig.admin`; operações com `x-requer-admin: true`; resposta `SemPermissao` |
| Sessão da área Jotanunes (2026-09-29) | `UsuarioFluig.origem`, `UsuarioFluig.trocaSenhaObrigatoria`, `OrigemSessao`, `LoginJotanunesInput`, `SessaoJotanunes`, `ConfiguracaoAcesso` |
| Usuário interno (§10) | `UsuarioInterno`, `UsuarioInternoInput`, `UsuarioInternoAtualizacao`, `PaginaUsuariosInternos`, `SituacaoUsuarioInterno` |
