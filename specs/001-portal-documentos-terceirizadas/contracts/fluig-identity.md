# Contrato de identidade da área Jotanunes → API (Fluig e login próprio)

Complementa o esquema `fluigAuth` de [`openapi.yaml`](openapi.yaml). Decisões e alternativas em
[`../research.md`](../research.md) R1 (Fluig), R16 (papel) e R17 (login próprio).

## Dois modos de entrada (desde a versão 1.2.0 do contrato)

A área Jotanunes (`fluig-app`) aceita duas identidades, que convivem. As rotas `/api/fluig/*` e as
regras de perfil são **as mesmas** para as duas.

| | Entrada pelo Fluig | Login próprio da área Jotanunes |
|---|---|---|
| Quem emite o token | o Fluig (dataset/serviço do Fluig) | a API, em `POST /api/fluig/auth/login` |
| Como chega ao `fluig-app` | `{FLUIG_APP_URL}/#fluigToken=<jwt>` | resposta do login (tela de login do `fluig-app`) |
| `iss` / segredo | `Auth__Fluig__Issuer` (`fluig`) / `Auth__Fluig__Secret` (compartilhado com o Fluig) | `jotanunes-docs` / `Auth__LoginLocal__Secret` (só a API conhece) |
| Claims | `sub`, `name`, `email`, `roles?`, `iat`, `exp` | as mesmas + `uid`, `ver`, `troca_senha` |
| Quem é administrador | grupo do Fluig → `roles: ["admin"]` | cadastro do usuário interno (tela "Usuários") → `roles: ["admin"]` |
| Papel alterado | vale até o token expirar (máx. 8 h) | sessão cai na hora (`ver`) |
| Revogação | não há (expira) | desativar, redefinir/trocar senha, mudar papel, "Sair" → 401 na hora |
| "Sair" / "Trocar senha" no menu | não aparecem | aparecem |
| Pode ser desligado | não (é a entrada padrão quando o Fluig existir) | sim: `Auth__LoginLocal__Habilitado=false` |

O `fluig-app` decide a tela assim: token no fragmento (Fluig) → `sessionStorage['jn.fluigToken']`
(qualquer origem) → sem token, `GET /api/fluig/auth/configuracao`: `loginLocalHabilitado=true` →
tela de login; `false` → "Abra este sistema pelo Fluig.". `GET /api/fluig/me` informa `origem`
(`FLUIG` | `LOGIN_LOCAL`) e `trocaSenhaObrigatoria`.

A API escolhe a validação pelo `iss` do token (lido sem validar, só para escolher): `jotanunes-docs`
→ esquema do login próprio; qualquer outro → esquema do Fluig. Cada esquema valida com o próprio
segredo e emissor, então um token do Fluig com `iss` trocado para `jotanunes-docs` (ou o contrário)
é recusado (401). `Auth__Fluig__Issuer` não pode ser `jotanunes-docs`.

---

# Parte 1 — Token do Fluig

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
   token em memória + `sessionStorage['jn.fluigToken']` e chama `GET /api/fluig/me`. O token do
   fragmento tem prioridade: se a aba tinha uma sessão de login próprio, ela é substituída pela do
   Fluig.
5. Token expirado/ausente → ~~tela "Abra este sistema pelo Fluig." (sem dados)~~ (desde 1.2.0) tela
   de login próprio, ou "Abra este sistema pelo Fluig." se o login próprio estiver desligado (sem
   dados em nenhum dos casos). Token do Fluig que expira no meio do uso continua levando a "Abra este
   sistema pelo Fluig." (a renovação é do Fluig).

## Desenvolvimento

- `node scripts/gerar-token-fluig-dev.mjs [--admin] [login] [nome] [email]` imprime um token válido
  por 8 h usando `FLUIG_JWT_SECRET` do `.env` na raiz. Sem `--admin` o token é de usuário **comum**
  (sem `roles`); com `--admin` inclui `"roles": ["admin"]`.
- `fluig-app` em `npm run dev`: sem fragmento, usa `VITE_FLUIG_DEV_TOKEN` (em `fluig-app/.env.local`).

## Troca para a integração real (Fluig)

A `Application` depende apenas de `IUsuarioFluigAtual`. Para outro mecanismo (RS256/JWKS, OAuth do
Fluig, validação da sessão via API REST do Fluig), substitua o handler do esquema de autenticação
`Fluig` na `Api` mantendo as claims `sub`/`name`/`email` e a regra de `roles` acima (o adaptador
`UsuarioFluigAtualDeClaims` expõe `EhAdmin`).

---

# Parte 2 — Login próprio da área Jotanunes

Para quando a Jotanunes não tem (ou não usa) o Fluig. Usuários internos ficam no banco
(`data-model.md` §10) e são gerenciados na tela "Usuários" do `fluig-app` (só administradores).

## Token

JWT **HS256**, emitido pela API, assinado com `Auth__LoginLocal__Secret` (≥ 32 bytes, diferente dos
segredos do Fluig e do portal; nunca sai do servidor). Validade 8 h.

```json
{
  "iss": "jotanunes-docs",
  "aud": "jotanunes-docs-api",
  "sub": "ana.souza",
  "name": "Ana Souza",
  "email": "ana.souza@jotanunes.com",
  "roles": ["admin"],
  "uid": "7b0c3f0e-3d52-4c8e-9a51-2f9d0a6f1c11",
  "ver": 3,
  "troca_senha": false,
  "iat": 1790000000,
  "exp": 1790028800
}
```

- `roles` segue **a mesma regra** da Parte 1 (a API usa o mesmo código para as duas origens); é
  gravada a partir da coluna `admin` do usuário interno e omitida para usuário comum.
- A cada requisição a API confere no banco: usuário `uid` existe, está ativo, `login = sub` e
  `versao_credencial = ver`; senão → 401 `NAO_AUTENTICADO`. A versão sobe ao desativar, reativar,
  redefinir senha, trocar senha, mudar o papel e sair.
- Com `troca_senha = true` só respondem `GET /api/fluig/me`, `POST /api/fluig/auth/trocar-senha` e
  `POST /api/fluig/auth/sair`; o resto → 403 `TROCA_SENHA_OBRIGATORIA`.
- O token do login próprio nunca vale em `/api/portal/*` (e o do portal nunca vale aqui).

## Fluxo

1. Sem token, o `fluig-app` chama `GET /api/fluig/auth/configuracao` (anônimo). Com
   `loginLocalHabilitado = true`, mostra a tela de login.
2. `POST /api/fluig/auth/login` `{ "login": "ana.souza", "senha": "..." }` → `SessaoJotanunes`
   (`accessToken`, `expiraEm`, `usuario`). O front guarda o token em memória +
   `sessionStorage['jn.fluigToken']` (a mesma chave do Fluig; a aba fechada encerra a sessão).
3. `usuario.trocaSenhaObrigatoria = true` (senha provisória) → tela "Crie uma nova senha para
   continuar."; `POST /api/fluig/auth/trocar-senha` devolve um token novo com `troca_senha = false`.
4. "Sair" → `POST /api/fluig/auth/sair` (revoga na API) e apaga o token local.
5. 401 no meio da sessão (expirou ou foi revogada) → volta à tela de login com "Sua sessão expirou.
   Entre de novo.".

Erros do login (títulos na tabela `CodigoErro` do `openapi.yaml`): `LOGIN_INVALIDO` (login
inexistente ou senha errada — mesma resposta), `ACESSO_BLOQUEADO` (5 falhas → 15 min, também para
login inexistente), `USUARIO_INATIVO`, `SENHA_PROVISORIA_EXPIRADA` (7 dias), `LIMITE_REQUISICOES`.

## Primeiro administrador (instalação)

```bash
# desenvolvimento (na pasta backend/, com as variáveis do quickstart exportadas)
dotnet run --project src/Jotanunes.Docs.Api -- criar-admin --login ana.souza --nome "Ana Souza" --email ana.souza@jotanunes.com
# produção (VPS): wrapper instalado pelo deploy/instalar.sh, com a mesma configuração do serviço
jotanunes-docs-criar-admin --login ana.souza --nome "Ana Souza" --email ana.souza@jotanunes.com
```

- Cria o administrador com senha provisória (7 dias, troca obrigatória), envia o e-mail de acesso e
  escreve a senha provisória **só no terminal** (nunca no log da aplicação).
- Já existe usuário interno administrador ativo → não faz nada (código de saída 2), salvo com
  `--forcar` (recuperação: cria o login ou transforma o login existente em administrador ativo com
  nova senha provisória, derrubando as sessões dele).
- Login próprio desligado ou argumentos inválidos → código 1.

## Configuração

| Variável | Padrão | Observação |
|---|---|---|
| `Auth__LoginLocal__Habilitado` | `true` | `false` desliga a tela de login e as rotas de login/troca/sair (404); tokens locais → 401 |
| `Auth__LoginLocal__Secret` | — | obrigatório com o login ligado; ≥ 32 bytes; diferente dos outros segredos |
| `FluigApp__BaseUrl` | `http://localhost:5173` (dev) | endereço da área Jotanunes usado nos e-mails de acesso; obrigatório fora de Development com o login ligado |

## Relação com o Fluig

- Usuários internos e usuários do Fluig não são ligados: são dois acessos independentes. As colunas
  de autoria guardam o login; recomenda-se cadastrar o usuário interno com o mesmo login que a pessoa
  terá no Fluig. A auditoria distingue a origem (`ator_tipo` `FLUIG` × `LOCAL`).
- Administradores de qualquer origem gerenciam os usuários internos. O sistema mantém sempre pelo
  menos um usuário interno administrador ativo.
