# Contrato de identidade Fluig → API

Complementa o esquema `fluigAuth` de [`openapi.yaml`](openapi.yaml). Decisão e alternativas em
[`../research.md`](../research.md#r1-identidade-fluig-na-api-sem-login-próprio).

## Token

JWT compacto, algoritmo **HS256**, assinado com o segredo compartilhado `FLUIG_JWT_SECRET`
(mínimo 32 bytes aleatórios; configurado no Fluig e na API como `Auth__Fluig__Secret`).

Header: `{"alg":"HS256","typ":"JWT"}`

Payload:

```json
{
  "iss": "fluig",
  "aud": "jotanunes-docs-api",
  "sub": "maria.silva",
  "name": "Maria Silva",
  "email": "maria.silva@jotanunes.com",
  "roles": ["admin"],
  "iat": 1790000000,
  "exp": 1790028800
}
```

`roles` é **opcional** (desde a versão 1.1.0 do contrato). No exemplo acima, Maria é
administradora; para um usuário comum a claim é omitida (ou vem sem `admin`).

| Regra de validação na API | Falha → |
|---|---|
| assinatura HS256 com `Auth__Fluig__Secret` | 401 `NAO_AUTENTICADO` |
| `iss` = `Auth__Fluig__Issuer`, `aud` = `Auth__Fluig__Audience` | 401 |
| `exp` no futuro (tolerância 2 min) e `exp − iat` ≤ 8 h | 401 |
| `sub`, `name` presentes e não vazios (`email` opcional, vira `""`) | 401 |
| `alg` diferente de HS256 (inclusive `none`) | 401 |

## Papel de administrador (claim `roles`)

| Situação da claim `roles` | Perfil na API | Observação |
|---|---|---|
| lista de textos contendo exatamente `"admin"` (ex.: `["admin"]`, `["admin","outro"]`) | **administrador** | comparação exata, sensível a maiúsculas |
| texto único `"admin"` (algumas bibliotecas JWT serializam lista de 1 item assim) | **administrador** | aceito por tolerância |
| ausente, `[]`, lista sem `"admin"` (ex.: `["Admin"]`, `["leitor"]`) | **comum** | valores desconhecidos são ignorados |
| tipo inesperado (`true`, número, objeto) | **comum** | o token continua válido (não vira 401); menor privilégio |

- O papel **não** muda quem pode abrir o sistema: isso continua sendo o grupo de acesso do Fluig
  (ver "Entrega ao `fluig-app`", passo 1). Um administrador também precisa estar no grupo de acesso.
- O papel vale **pelo tempo de vida do token** (máx. 8 h). Se a TI tirar alguém do grupo de
  administradores, o token que a pessoa já tem continua de administrador até expirar; para valer na
  hora, a pessoa fecha o sistema e o abre de novo pelo Fluig (novo token, já sem `roles`). O mesmo
  vale para quem acabou de ganhar o papel. A API não consulta o Fluig a cada requisição (research R1).
- Operações que exigem administrador: as marcadas com `x-requer-admin: true` no
  [`openapi.yaml`](openapi.yaml). Usuário comum → `403 SEM_PERMISSAO`.
- `GET /api/fluig/me` devolve `admin: true|false` para o `fluig-app` esconder as ações.

### Como a TI configura no Fluig

1. **Grupos** (Painel de Controle → Grupos):
   - `DOCS_TERCEIRIZADAS` — quem pode abrir o sistema (já existia: controla a página/widget);
   - `DOCS_TERCEIRIZADAS_ADMIN` — administradores (também devem estar em `DOCS_TERCEIRIZADAS`).
   Os códigos são sugestão; o nome do grupo de administradores fica **só no Fluig** (parâmetro do
   widget/dataset), a API conhece apenas o valor `admin` da claim.
2. **Emissão do token** (o mesmo dataset/serviço que já assina o JWT): depois de ler o usuário
   logado, verificar se ele pertence ao grupo de administradores — por exemplo, consultando o dataset
   `colleagueGroup` com os filtros `colleagueGroupPK.colleagueId = <usuário>` e
   `colleagueGroupPK.groupId = DOCS_TERCEIRIZADAS_ADMIN` — e, se pertencer, acrescentar
   `"roles": ["admin"]` ao payload antes de assinar. Se não pertencer, **não** incluir a claim.
3. **Teste**: abrir o sistema com um usuário de cada grupo e conferir, no fluig-app, que só o
   administrador vê os botões de cadastro e de análise (ou chamar `GET /api/fluig/me` e conferir
   `admin`).

## Entrega ao `fluig-app`

1. O usuário abre, no Fluig, a página/widget "Documentação de Terceirizadas" (acesso controlado por
   grupo/papel do Fluig).
2. O widget obtém o token (dataset customizado ou serviço do Fluig que assina com o usuário logado).
3. O widget abre `{FLUIG_APP_URL}/#fluigToken=<jwt>` em iframe ou nova aba.
4. O `fluig-app` lê `fluigToken` do fragmento, apaga o fragmento (`history.replaceState`), guarda o
   token em memória + `sessionStorage['jn.fluigToken']` e chama `GET /api/fluig/me`.
5. Token expirado/ausente → tela "Abra este sistema pelo Fluig." (sem dados).

## Desenvolvimento

- `node scripts/gerar-token-fluig-dev.mjs [--admin] [login] [nome] [email]` imprime um token válido
  por 8 h usando `FLUIG_JWT_SECRET` do `.env` na raiz. Sem `--admin` o token é de usuário **comum**
  (sem `roles`); com `--admin` inclui `"roles": ["admin"]`.
- `fluig-app` em `npm run dev`: sem fragmento, usa `VITE_FLUIG_DEV_TOKEN` (em `fluig-app/.env.local`).

## Troca para a integração real

A `Application` depende apenas de `IUsuarioFluigAtual`. Para outro mecanismo (RS256/JWKS, OAuth do
Fluig, validação da sessão via API REST do Fluig), substitua o handler do esquema de autenticação
`Fluig` na `Api` mantendo as claims `sub`/`name`/`email` e a regra de `roles` acima (o adaptador
`UsuarioFluigAtualDeClaims` expõe `EhAdmin`).
