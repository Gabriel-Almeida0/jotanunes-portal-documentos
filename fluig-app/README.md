# fluig-app — Área Jotanunes

Interface interna da Jotanunes para o Portal de Documentação de Terceirizadas. Tem **duas entradas**
que convivem (ver [Dois modos de entrada](#dois-modos-de-entrada)): **de dentro do Fluig** (iframe ou
nova aba, com um token emitido pelo Fluig) e **login próprio** (login + senha de usuário interno,
enquanto a Jotanunes não tem o Fluig).
Aqui o administrador cadastra obras, empresas, vínculos e tipos de documento e analisa os documentos
enviados; qualquer usuário com acesso consulta tudo e envia convites (ver [Perfis](#perfis)).

- Stack: React 18 + Vite 5 + TypeScript (strict), `react-router-dom` 6 (`HashRouter`).
- Visual: **CSS puro** com os tokens `--jn-*` de [`docs/design.md`](../docs/design.md), tudo escopado
  em `.jn-app` (não conflita com o tema do Fluig). Sem framework/biblioteca de CSS ou componentes
  (`npm run check:css` confere). Ícones em SVG inline.
- Contrato: [`specs/001-portal-documentos-terceirizadas/contracts/openapi.yaml`](../specs/001-portal-documentos-terceirizadas/contracts/openapi.yaml).
  Os tipos TypeScript são gerados dele (`npm run gen:api` → `src/api/schema.d.ts`, não editar à mão).

## Scripts

| Comando | O que faz |
|---|---|
| `npm install` | Instala as dependências (Node 22) |
| `npm run dev` | Servidor de desenvolvimento em http://localhost:5173 |
| `npm run build` | Checagem de tipos + build de produção em `dist/` |
| `npm test` | Testes (Vitest + Testing Library + MSW) |
| `npm run lint` | ESLint |
| `npm run gen:api` | Regenera `src/api/schema.d.ts` a partir do contrato |
| `npm run check:css` | Falha se houver framework/biblioteca de CSS no `package.json` |

## Variáveis de ambiente

Copie `.env.example` para `.env.local` (não versionado):

| Variável | Uso |
|---|---|
| `VITE_API_URL` | URL da API. Dev: `http://localhost:5080` |
| `VITE_USE_MOCKS` | `true` = respostas simuladas (MSW) conforme o contrato, sem backend |
| `VITE_FLUIG_DEV_TOKEN` | Só em `npm run dev`: token Fluig usado quando a URL não traz `#fluigToken=` |
| `VITE_MOCK_PERFIL` | Só com `VITE_USE_MOCKS=true`: `admin` (padrão) ou `comum` — perfil do usuário simulado |
| `VITE_MOCK_LOGIN` | Só com `VITE_USE_MOCKS=true`: `true` = começa **sem** token e mostra a tela de login próprio |

## Dois modos de entrada

Regras completas em
[`contracts/fluig-identity.md`](../specs/001-portal-documentos-terceirizadas/contracts/fluig-identity.md)
(research R17). As rotas `/api/fluig/*` e as regras de perfil são as mesmas nas duas.

| | Pelo Fluig | Login próprio |
|---|---|---|
| Como chega o token | `#fluigToken=<jwt>` na URL (o app apaga da barra de endereço) | tela de login (`POST /api/fluig/auth/login`) |
| Quem é administrador | grupo do Fluig (`roles: ["admin"]`) | cadastro do usuário na tela "Usuários" |
| "Trocar senha" e "Sair" no menu | não aparecem | aparecem (rodapé do menu lateral) |
| Sessão caiu (401) | "Abra este sistema pelo Fluig." | tela de login com "Sua sessão expirou. Entre de novo." |

Ordem de decisão ao abrir: token no fragmento (Fluig, tem prioridade e substitui uma sessão de login
próprio na mesma aba) → `sessionStorage['jn.fluigToken']` (qualquer origem) → (dev) token de
desenvolvimento → sem token, `GET /api/fluig/auth/configuracao`: login próprio ligado → tela de login;
desligado → "Abra este sistema pelo Fluig.". A origem da sessão vem de `GET /api/fluig/me` (`origem`).

- **Primeiro acesso**: com senha provisória (`trocaSenhaObrigatoria`), só a tela "Crie uma nova senha
  para continuar." aparece (nenhuma rota do app monta, nem digitando o endereço). A senha nova segue a
  regra do portal: 8 a 128 caracteres, letras e números, diferente da atual.
- **Senha esquecida**: não há autoatendimento; um administrador usa "Redefinir senha" na tela
  "Usuários" e a pessoa recebe uma nova senha provisória por e-mail.
- **Primeiro administrador** de uma instalação nova: comando `criar-admin` da API
  ([quickstart](../specs/001-portal-documentos-terceirizadas/quickstart.md) e
  `contracts/fluig-identity.md`, "Primeiro administrador").

## Perfis

Na entrada pelo Fluig, o perfil vem da claim `roles` do token; no login próprio, do cadastro do
usuário interno (regras em
[`contracts/fluig-identity.md`](../specs/001-portal-documentos-terceirizadas/contracts/fluig-identity.md)).
O app lê o campo `admin` de `GET /api/fluig/me`.

| | Administrador (`roles` contém `admin`) | Comum (sem `roles`, ou sem `admin`) |
|---|---|---|
| Painel, listas, detalhes, documentos, histórico, abrir/baixar arquivo | Sim | Sim |
| Enviar/reenviar convite | Sim | Sim |
| Cadastrar/editar/ativar/desativar obra, empresa e tipo de documento; vincular/desvincular | Sim | Não |
| Aprovar/rejeitar envio | Sim | Não |
| Tela "Usuários" (usuários do login próprio) | Sim | Não (o menu não mostra; `#/usuarios` mostra só o aviso, sem chamar a API) |

- Para o usuário comum as ações de administrador **somem** (não ficam desabilitadas), os dados da
  empresa aparecem em modo leitura, o link da fila vira "Ver →" e cada tela mostra uma vez o aviso
  "Só administradores podem cadastrar, alterar ou analisar. Se você precisa, fale com a TI."
- Quem decide é a API: operação de administrador feita por usuário comum volta `403 SEM_PERMISSAO`.
  O app mostra a mensagem na tela, fecha o modal e mantém os dados — a sessão continua (só o `401`
  leva para "Abra este sistema pelo Fluig.").
- O perfil vale pelo tempo de vida do token. Mudou o grupo no Fluig? Feche e abra o sistema pelo
  Fluig de novo. No login próprio, mudar o perfil derruba a sessão na hora (a pessoa entra de novo já
  com o perfil novo).
- Código: `useEhAdmin()` (`src/auth/contexto.ts`), `<SomenteAdmin>` e `<AvisoSomenteAdmin>`
  (`src/components/`).

## Rodar com mocks (sem backend)

```bash
cd fluig-app
npm install
VITE_USE_MOCKS=true npm run dev
```

Abra http://localhost:5173. Com mocks e sem token, o app usa um token fictício de desenvolvimento e
entra como **Analista Dev** (administrador). Os dados ficam em memória (recarregar a página volta ao
estado inicial).

Para ver o app como usuário comum (**João Comum**):

```bash
VITE_USE_MOCKS=true VITE_MOCK_PERFIL=comum npm run dev
```

Com `VITE_MOCK_PERFIL=comum`, `/me` devolve `admin: false` e as 10 operações `x-requer-admin` do
contrato respondem `403 SEM_PERMISSAO` (convites e consultas continuam liberados). Nos testes, use
`definirPerfilMock('comum')` de `src/mocks/dados.ts`; o `src/test/setup.ts` volta para `admin` depois
de cada teste.

### Login próprio com mocks

```bash
VITE_USE_MOCKS=true VITE_MOCK_LOGIN=true npm run dev
```

O app abre na tela de login. Usuários do mock (os mesmos do quickstart §5):

| Login | Senha | Resultado |
|---|---|---|
| `admin.mock` | `Admin1234` | administrador (vê "Usuários") |
| `comum.mock` | `Comum1234` | usuário comum |
| `novo.mock` | `Temp1234` | senha provisória → "Crie uma nova senha para continuar." (ex.: `Nova1234`) |
| `inativo.mock` | qualquer senha certa (`Inativo1234`) | "Este usuário está desativado. Fale com um administrador do sistema." |
| `expirado.mock` | `Temp1234` | "Sua senha provisória expirou. Peça a um administrador para gerar outra." |

Senha errada 5 vezes seguidas no mesmo login (existente ou não) bloqueia a 6ª tentativa por 15
minutos. Usuários cadastrados na tela "Usuários" do mock recebem a senha provisória `Temp1234`; um
e-mail do domínio `falha.test` simula a falha do e-mail de acesso (`EMAIL_ACESSO_FALHOU`). Os dados
ficam em memória: depois de recarregar a página, um token de sessão emitido depois de uma troca de
senha deixa de valer e o app volta ao login.

Nos testes: `definirSessaoMock({ origem: 'LOGIN_LOCAL' })` faz o token genérico dos testes virar a
sessão de `admin.mock` (ou `comum.mock`, com `perfil: 'comum'`); `definirLoginLocalMock(false)`
simula o login próprio desligado. O `setup.ts` volta ao padrão (administrador pelo Fluig, login
próprio ligado) depois de cada teste.

Cenários úteis nos mocks:

- `http://localhost:5173/#fluigToken=expirado` → tela "Abra este sistema pelo Fluig." (401 no `/me`).
- Empresa com e-mail de contato contendo `falha` (ex.: `falha@teste.test`) → o convite devolve
  `EMAIL_FALHOU` (502).
- Empresas de exemplo: Alfa (acesso ativo, com envios aprovados, rejeitado e em análise), Beta
  (convidada, CNPJ alfanumérico `12.ABC.345/01DE-35`), Gama (não convidada), Delta (convite expirado),
  Épsilon (desativada) e Zeta (envios em análise).

## Rodar com a API real

1. Suba o Postgres e a API conforme o [quickstart](../specs/001-portal-documentos-terceirizadas/quickstart.md).
2. Gere um token de desenvolvimento na raiz do repositório (quickstart §3):

   ```bash
   node scripts/gerar-token-fluig-dev.mjs --admin dev.admin "Admin Dev" admin@jotanunes.com   # administrador
   node scripts/gerar-token-fluig-dev.mjs dev.analista "Analista Dev" analista@jotanunes.com   # usuário comum
   ```

   Com `--admin` o token traz `"roles": ["admin"]`; sem a opção a claim é omitida (usuário comum).

3. Em `fluig-app/.env.local`:

   ```bash
   VITE_API_URL=http://localhost:5080
   VITE_USE_MOCKS=false
   VITE_FLUIG_DEV_TOKEN=<token gerado>
   ```

4. `npm run dev` e abra http://localhost:5173 — ou, sem `VITE_FLUIG_DEV_TOKEN`, abra
   `http://localhost:5173/#fluigToken=<token>`.

A API precisa liberar a origem `http://localhost:5173` em `Cors__Origins`.

## Como o Fluig abre o app

Contrato completo em [`contracts/fluig-identity.md`](../specs/001-portal-documentos-terceirizadas/contracts/fluig-identity.md).

1. Um widget/página do Fluig gera um JWT HS256 do usuário logado (`iss=fluig`,
   `aud=jotanunes-docs-api`, `sub`=login, `name`, `email`, validade ≤ 8 h) e, se ele estiver no grupo
   de administradores do Fluig, `"roles": ["admin"]`.
2. O widget abre `{URL do fluig-app}/#fluigToken=<jwt>` em iframe ou nova aba.
3. O app lê o token do fragmento, **apaga o fragmento da URL** (`history.replaceState`), guarda o
   token em memória e em `sessionStorage['jn.fluigToken']` e chama `GET /api/fluig/me`. O Fluig pode
   renovar o token trocando só o fragmento, com o app aberto (a tela e a rota continuam).
4. Token do Fluig recusado (401) → só "Abra este sistema pelo Fluig." — nenhum dado é carregado. Sem
   token nenhum, aparece a tela de login próprio (ou a mesma mensagem, se o login próprio estiver
   desligado na API).

O build usa `base: './'` e `HashRouter`, então `dist/` pode ser servido em qualquer caminho, sem
regra de reescrita. Em produção, o servidor que hospeda o app deve enviar
`Content-Security-Policy: frame-ancestors <domínio do Fluig>`.

## Telas e rotas

| Rota | Tela |
|---|---|
| `#/` | Painel: indicadores com atalhos para as listas filtradas |
| `#/obras` | Obras: busca, situação, paginação, cadastro (admin) |
| `#/obras/:obraId` | Obra: dados, empresas vinculadas; editar, ativar/desativar, vincular/desvincular (admin) |
| `#/empresas` | Empresas: busca por nome/CNPJ, filtros por obra, situação de acesso e pendência; cadastro (admin) |
| `#/empresas/:empresaId` | Empresa: dados (editáveis pelo admin; leitura para o comum), acesso ao portal e convites, obras, documentos e histórico |
| `#/tipos-documento` | Tipos de documento: lista; cadastro, edição, ativar/desativar (admin) |
| `#/analise` | Fila de análise: em análise (mais antigo primeiro) e analisados, com filtros |
| `#/analise/:envioId` | Análise do envio: abrir/baixar arquivo; aprovar, rejeitar com motivo (admin) |
| `#/usuarios` | Usuários (só admin): lista com busca e filtros; cadastrar, editar, desativar/reativar, redefinir senha. Na própria linha (login próprio) não há "Desativar" e o perfil é só leitura |
| `#/trocar-senha` | Trocar senha (só login próprio; com sessão do Fluig volta ao painel) |

Antes da sessão (fora das rotas): tela de login (`pages/Login.tsx`, o único lugar com o logo, dentro
do painel de acesso) e troca obrigatória de senha (`pages/TrocaSenha.tsx`, modo obrigatório).

## Estrutura

```text
src/
├── api/          schema.d.ts (gerado), client.ts (fetch + ErroApi), fluig.ts (uma função por rota), useConsulta.ts
├── assets/       logo-jotanunes.png (só na tela de login)
├── auth/         tokenFluig.ts (fragmento/sessionStorage/dev), AuthFluigProvider.tsx (login/negado/trocaSenha/ok), contexto.ts (useUsuarioFluig, useEhAdmin, useSessao)
├── components/   SomenteAdmin, AvisoSomenteAdmin, Botao, Campo, Selo, TituloPagina, Tabela, Paginacao, Modal, Filtros, Alerta, Estados, Layout, icons/
├── hooks/        useAviso, useFormularioEmpresa
├── mocks/        MSW: dados.ts (banco em memória), handlers/*, browser.ts, server.ts
├── pages/        uma página por rota (+ .css) e seus testes
├── styles/       tokens.css (docs/design.md §10 em .jn-app), base.css, paginas.css
├── test/         setup.ts (jest-dom + servidor MSW), renderizar.tsx (rota com usuário pronto), renderizarApp.tsx (app completo com o provider)
└── utils/        cnpj.ts (numérico e alfanumérico), datas.ts (America/Sao_Paulo), senha.ts (política de senha), formatos.ts
```

Mensagens de erro exibidas ao usuário vêm do `title` do `application/problem+json` da API (tabela
`CodigoErro` do contrato); `src/api/mensagens.ts` só é usado como reserva quando não há corpo.
