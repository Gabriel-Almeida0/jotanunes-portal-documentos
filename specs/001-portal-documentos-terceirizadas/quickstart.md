# Quickstart — Portal de Documentação de Terceirizadas Jotanunes

Guia para subir o ambiente local e validar a feature de ponta a ponta. Detalhes de rotas e schemas
em [`contracts/openapi.yaml`](contracts/openapi.yaml); regras de dados em
[`data-model.md`](data-model.md).

## 1. Pré-requisitos

- Docker (com `docker compose`), .NET SDK 8, Node 22.
- Portas livres: 5432 (Postgres), 5080 (API), 5173 (`fluig-app`), 5174 (`portal`).

## 2. Configuração

```bash
cp .env.example .env                       # raiz: FLUIG_JWT_SECRET, AUTH_PORTAL_SECRET, AUTH_LOGIN_LOCAL_SECRET, POSTGRES_*
# gere segredos (32+ bytes, um diferente para cada) para FLUIG_JWT_SECRET, AUTH_PORTAL_SECRET e
# AUTH_LOGIN_LOCAL_SECRET no .env:
openssl rand -base64 48
```

A API lê a configuração das variáveis de ambiente (ver tabela em [`plan.md`](plan.md#configuração-variáveis-de-ambiente)).
Em dev, `backend/src/Jotanunes.Docs.Api/Properties/launchSettings.json` aponta para o Postgres do
compose e **não** contém segredos. Antes do `dotnet run`, exporte os segredos no mesmo shell
(o `.env` da raiz não é lido pela API):

```bash
set -a; source .env; set +a
export Auth__Fluig__Secret="$FLUIG_JWT_SECRET" Auth__Portal__Secret="$AUTH_PORTAL_SECRET"
export Auth__LoginLocal__Secret="$AUTH_LOGIN_LOCAL_SECRET"   # login próprio da área Jotanunes (R17)
export ConnectionStrings__Default="Host=localhost;Port=5432;Database=jotanunes_docs;Username=${POSTGRES_USER:-jotanunes};Password=${POSTGRES_PASSWORD:-jotanunes}"
export Resend__ApiKey="$RESEND_API_KEY" Resend__From="$RESEND_FROM"   # opcionais
```

Sem `Resend__ApiKey`, os e-mails aparecem no log da API (somente em Development) — inclusive o
e-mail de acesso de usuário interno, com a senha provisória.

Login próprio da área Jotanunes: ligado por padrão (`Auth__LoginLocal__Habilitado=true`); o link dos
e-mails de acesso usa `FluigApp__BaseUrl` (em dev, `http://localhost:5173`, já no
`launchSettings.json`). Para testar só com o Fluig: `export Auth__LoginLocal__Habilitado=false`.

## 3. Subir

```bash
docker compose up -d                                   # Postgres 16
cd backend && dotnet run --project src/Jotanunes.Docs.Api   # http://localhost:5080 (aplica migrations)
cd fluig-app && npm install && npm run dev             # http://localhost:5173
cd portal && npm install && npm run dev                # http://localhost:5174
node scripts/gerar-token-fluig-dev.mjs --admin dev.admin "Admin Dev" admin@jotanunes.com   # administrador
node scripts/gerar-token-fluig-dev.mjs dev.analista "Analista Dev" analista@jotanunes.com   # usuário comum
```

Coloque o token gerado em `fluig-app/.env.local` (`VITE_FLUIG_DEV_TOKEN=...`) ou abra
`http://localhost:5173/#fluigToken=<token>`. Sem `--admin` o token não tem a claim `roles` e o
usuário é **comum** (consulta e convida; não cadastra nem analisa). Com `--admin` o token traz
`"roles": ["admin"]` (ver [`contracts/fluig-identity.md`](contracts/fluig-identity.md)). Para
trocar de perfil numa aba já aberta, abra de novo com `#fluigToken=<outro token>` (o fragmento tem
prioridade sobre o `sessionStorage`).

### Primeiro administrador interno (login próprio)

Com a API configurada (mesmas variáveis exportadas acima), numa instalação sem usuários internos:

```bash
cd backend && dotnet run --project src/Jotanunes.Docs.Api -- criar-admin --login dev.admin.local --nome "Admin Local" --email admin.local@jotanunes.com
```

O terminal mostra a senha provisória (vale 7 dias) e o e-mail de acesso sai pelo Resend (ou aparece no
log da API em dev). Rodar de novo sem `--forcar` → "já existe administrador" (código 2) e nada muda.
Em produção, o comando equivalente é `jotanunes-docs-criar-admin ...` na VPS (ver
`deploy/README.md`). Detalhes em [`contracts/fluig-identity.md`](contracts/fluig-identity.md), Parte 2.

Na primeira subida com o banco vazio, a API cria os **10 tipos de documento padrão**
(`data-model.md` §4.1); nas próximas, não cria nada. Para desligar:
`Catalogo__SemearTiposPadrao=false`.

Checagem rápida: `curl http://localhost:5080/health` → `{"status":"ok"}`.

## 4. Testes automatizados

```bash
cd backend && dotnet test               # unitários + integração (Testcontainers sobe Postgres próprio)
cd fluig-app && npm test                # Vitest + Testing Library (MSW)
cd portal && npm test
```

Esperado: todos verdes; a suíte `Autorizacao*` do backend cobre isolamento entre empresas,
separação dos esquemas Fluig/login próprio/portal (SC-003, SC-008) e perfis — `PerfilAdminTests`
percorre todas as rotas `/api/fluig/*` de escrita e as de usuários internos com token comum (403
`SEM_PERMISSAO`) e admin (sucesso), **nas duas origens** (token Fluig e token do login próprio)
(SC-009, SC-012); `RevogacaoLoginLocalTests` cobre SC-013 e `LoginLocalTests` a anti-enumeração
(SC-014).

## 5. Frontends sem backend (mocks do contrato)

```bash
VITE_USE_MOCKS=true npm run dev         # em fluig-app/ ou portal/
```

Os handlers MSW em `src/mocks/` respondem conforme o `openapi.yaml`. No portal, o mock aceita
CNPJ `12.345.678/0001-95` com senha `Temp1234` (troca obrigatória) e depois `Nova1234`.
No `fluig-app`, o mock de `/api/fluig/me` é administrador por padrão; `VITE_MOCK_PERFIL=comum`
simula o usuário comum (as rotas de administrador do mock passam a responder 403 `SEM_PERMISSAO`).
Com `VITE_MOCK_LOGIN=true` o `fluig-app` começa **sem** token e mostra a tela de login próprio; o mock
aceita `admin.mock`/`Admin1234` (administrador), `comum.mock`/`Comum1234` (comum),
`novo.mock`/`Temp1234` (senha provisória → troca obrigatória; nova senha `Nova1234`) e recusa
`inativo.mock` (`USUARIO_INATIVO`).

## 6. Roteiro E2E manual (critérios de aceite)

Use um navegador com o `fluig-app` (token de dev) e outro perfil/aba anônima com o `portal`.
Comece com o **banco vazio** para ver o catálogo padrão: se já rodou antes, `docker compose down -v`
(apaga os dados locais do Postgres de desenvolvimento) e suba de novo. Os passos 1–30 usam o token
**administrador**; os passos 31–38 usam também o token **comum**; os passos 39–56 cobrem o **login
próprio** (US8–US10) — comece-os com a API com `Auth__LoginLocal__Secret` configurado e sem usuários
internos.

| # | Passo | Resultado esperado | Cobre |
|---|---|---|---|
| 1 | Abrir `http://localhost:5173` **sem** token (aba anônima, sem `VITE_FLUIG_DEV_TOKEN`) | Tela de login próprio ("Login", "Senha", "Acessar", logo no painel) e nenhum dado; com `Auth__LoginLocal__Habilitado=false`, "Abra este sistema pelo Fluig." | US1-2, US8-1/10, FR-002, FR-101 |
| 2 | Abrir com token de dev **administrador** | Painel com o nome "Admin Dev", sem tela de login | US1-1, FR-001 |
| 3 | Tipos de documento (banco vazio na subida) → conferir a lista; tentar cadastrar "Cartão CNPJ" de novo | 10 tipos padrão ativos com instruções (`data-model.md` §4.1); o repetido dá "Já existe um tipo de documento com este nome." | US7-1, FR-090, FR-014 |
| 4 | Obras → cadastrar "Residencial Vista do Rio", Aracaju/SE | Obra listada | FR-010 |
| 5 | Empresas → cadastrar "Alfa Engenharia Ltda", CNPJ `11.222.333/0001-81`, e-mail `contato@alfa.test` | Acesso "Não convidada"; 0 de 10 aprovados | US1-3, FR-011 |
| 6 | Repetir o cadastro com CNPJ `11222333000181` | Erro "Já existe uma empresa com este CNPJ." | US1-4 |
| 7 | Cadastrar "Beta Serviços" com CNPJ alfanumérico válido (ex.: `12.ABC.345/01DE-35`) e e-mail `contato@beta.test`; tentar outro com DV errado | O válido é salvo; o inválido é recusado no campo CNPJ | US1-5, FR-012 |
| 8 | Obra → vincular Alfa e Beta; vincular Alfa de novo | Duas empresas na obra, sem duplicar | US1-6, FR-013 |
| 9 | Empresa Alfa → "Enviar convite" | Acesso "Convidada"; no log da API: e-mail com link `http://localhost:5174/acesso?convite=...`, obra vinculada e senha temporária | US2-1, FR-020 |
| 10 | Abrir o link do convite no portal | Tela "Acesse o portal de documentos" com CNPJ preenchido | US2-2 |
| 11 | Entrar com CNPJ + senha temporária | Tela "Crie uma nova senha para continuar."; tentar navegar para `/documentos` volta para a troca | US2-3, FR-004 |
| 12 | Tentar nova senha `abc` | Mensagem de senha fraca | FR-007 |
| 13 | Criar senha `Alfa2026ok` | Vai para "Meus documentos": 10 documentos "Pendente de envio" | US2-3, US3-1 |
| 14 | Sair e entrar com a senha temporária | "CNPJ ou senha incorretos." | US2-4 |
| 15 | Entrar com a senha nova; enviar um `.pdf` válido para "Cartão CNPJ" | Situação "Em análise" com nome do arquivo e data | US3-2, FR-031 |
| 16 | Tentar enviar um `.exe` renomeado para `.pdf` e um PDF de 11 MB | Recusados: "Envie um arquivo PDF, JPG ou PNG." / "O arquivo passa de 10 MB." | US3-3, FR-032/033 |
| 17 | "Cartão CNPJ" em análise | Sem botão de envio | US3-4 |
| 18 | Clicar no nome do arquivo | Download do próprio arquivo | US3-7, FR-034 |
| 19 | Convidar Beta, fazer o primeiro acesso e, com o token da Beta, chamar `GET /api/portal/envios/{id do envio da Alfa}/arquivo` (DevTools/curl) | 404 | US3-5, FR-035 |
| 20 | Chamar `GET /api/fluig/obras` com o token do portal e `GET /api/portal/documentos` com o token Fluig | 401 nos dois | FR-002/003 |
| 21 | fluig-app → Fila de análise | Envio da Alfa listado (mais antigo primeiro); abrir arquivo funciona | US4-1/2, FR-040/041 |
| 22 | Rejeitar sem motivo; depois com motivo "Documento ilegível, envie de novo" | Primeiro recusado; depois "Rejeitado"; no log: e-mail de rejeição para a Alfa | US4-4/5, FR-042/045 |
| 23 | Portal da Alfa → recarregar | "Rejeitado" + motivo + "Enviar novo arquivo"; reenviar → "Em análise" | US4-6, SC-004 |
| 24 | fluig-app → aprovar o novo envio; abrir histórico da Alfa | 2 envios: aprovado (analista, data) e rejeitado (analista, data, motivo) | US4-3/8, SC-005 |
| 25 | Em duas abas do fluig-app, aprovar o mesmo envio em análise | A segunda recebe "Este envio já foi analisado." | US4-7, FR-044 |
| 26 | Portal: 5 senhas erradas e uma 6ª tentativa | Bloqueio por 15 minutos | US2-7, FR-006 |
| 27 | fluig-app → reenviar convite da Alfa | Sessão atual do portal da Alfa cai (401); nova senha temporária no log; troca obrigatória de novo | US2-6, FR-022 |
| 28 | Desativar a Beta e tentar entrar no portal com ela | Acesso recusado ("Esta empresa está desativada.") | US2-8 |
| 29 | Cadastrar novo tipo "NR-35" | Aparece "Pendente de envio" para Alfa e Beta (se ativa) | FR-015 |
| 30 | Painel e detalhe da obra | Contagens batem com os passos anteriores | US5, FR-050/051 |
| 31 | Abrir `http://localhost:5173/#fluigToken=<token comum>` | Nome "Analista Dev"; painel, obras, empresas, tipos e fila com dados; **nenhum** botão de criar, editar, ativar/desativar, vincular/desvincular, aprovar ou rejeitar; aviso "Só administradores podem cadastrar, alterar ou analisar. Se você precisa, fale com a TI." | US6-2, FR-082/084 |
| 32 | Comum → empresa Alfa | Dados em modo leitura (sem formulário); documentos e histórico visíveis; "Reenviar convite" funciona (novo e-mail no log) | US6-4/5, FR-082 |
| 33 | Comum → fila de análise → um envio | Detalhe e "Abrir arquivo" funcionam; sem "Aprovar"/"Rejeitar" | US6-5, FR-082 |
| 34 | Com o token comum: `curl -X POST http://localhost:5080/api/fluig/tipos-documento -H "Authorization: Bearer <comum>" -H 'Content-Type: application/json' -d '{"nome":"Teste comum"}'` e `curl -X POST .../api/fluig/envios/<id em análise>/aprovar -H "Authorization: Bearer <comum>"` | 403 com `code: SEM_PERMISSAO` nos dois; o tipo não existe; o envio continua "Em análise" | US6-3, FR-083, SC-009 |
| 35 | `curl .../api/fluig/me` com cada token | `"admin": true` (admin) e `"admin": false` (comum) | FR-086 |
| 36 | Com o token admin, aprovar o envio do passo 34; depois `docker compose exec postgres psql -U jotanunes jotanunes_docs -c "select acao, ator_id, ator_admin, recurso_id from auditoria order by id desc limit 10"` | Aprovação ok; linhas `PERMISSAO_NEGADA` (dev.analista, `ator_admin=false`, `fluigCriarTipoDocumento`/`fluigAprovarEnvio`), `CONVITE_ENVIADO` do comum com `ator_admin=false` e `ENVIO_APROVADO` com `ator_admin=true` | US6-8, FR-061/085 |
| 37 | Parar e subir a API de novo (2 vezes) | Tipos de documento continuam os mesmos (10 padrão + "NR-35"), sem duplicar nem reativar | US7-2/3/4, FR-091/092, SC-010 |
| 38 | Token admin de uma usuária e, depois de "tirar o papel" (gerar token comum para o mesmo login), continuar com a aba antiga; depois abrir com `#fluigToken=<novo>` | Aba antiga continua admin até o token expirar; com o token novo, vira comum | US6-7, FR-086 |
| 39 | Rodar `criar-admin --login dev.admin.local --nome "Admin Local" --email admin.local@jotanunes.com` (§3) | Terminal mostra a senha provisória e o endereço; e-mail de acesso no log da API (login, senha provisória, link `http://localhost:5173`, 7 dias); `grep` da senha provisória no **log da aplicação** (saída do `dotnet run` da API) não acha nada fora do corpo do e-mail de dev | US10-1/5, FR-111, SC-015 |
| 40 | Rodar o mesmo comando de novo (sem `--forcar`) | Mensagem "já existe administrador ativo", código de saída 2; nada muda | US10-2 |
| 41 | Aba anônima em `http://localhost:5173` → entrar com `dev.admin.local` + senha provisória | Tela "Crie uma nova senha para continuar."; digitar `#/obras` na barra continua na troca; `curl .../api/fluig/obras` com esse token → 403 `TROCA_SENHA_OBRIGATORIA` | US8-2, FR-102 |
| 42 | Criar a senha `Local2026ok` | Painel com "Admin Local"; menu com "Usuários", "Trocar senha" e "Sair" | US8-3, FR-105 |
| 43 | Usuários → "Novo usuário": `ana.comum`, "Ana Comum", `ana@jotanunes.com`, perfil comum | Lista mostra "Aguardando primeiro acesso"; a senha provisória **não** aparece na tela; e-mail de acesso no log | US9-1/2, FR-102, FR-108 |
| 44 | Cadastrar outro com login `ANA.COMUM` | "Já existe um usuário com este login." | US9-3, FR-109 |
| 45 | Em outra aba anônima, entrar como `ana.comum` (senha do e-mail), trocar a senha | Painel sem "Usuários" no menu e sem botões de administrador (aviso de perfil comum, como no passo 31); "Sair" e "Trocar senha" presentes; abrir `#/usuarios` mostra só o aviso de administrador | US8-3, US9-11, FR-107, FR-108 |
| 46 | Com o token da Ana (DevTools → `sessionStorage['jn.fluigToken']`): `curl .../api/fluig/usuarios` e `curl -X POST .../api/fluig/tipos-documento ...` | 403 `SEM_PERMISSAO` nos dois, sem dados | US9-11, FR-107, SC-012 |
| 47 | Admin torna a Ana administradora; Ana clica em qualquer tela | Ana volta para a tela de login ("Sua sessão expirou. Entre de novo."); entrando de novo, vê "Usuários" | US9-6, FR-106, SC-013 |
| 48 | Admin desativa a Ana; Ana clica em qualquer tela; tenta entrar | Sessão cai (tela de login); login recusado com "Este usuário está desativado. Fale com um administrador do sistema." | US9-7, US8-6, FR-106 |
| 49 | Admin reativa a Ana e clica em "Redefinir senha" | Novo e-mail com nova senha provisória; a senha antiga da Ana não funciona mais; a nova leva à troca obrigatória | US9-8, FR-102, FR-106 |
| 50 | Na linha do próprio "Admin Local" | Sem "Desativar" e sem opção de tirar o papel; `curl -X PUT .../api/fluig/usuarios/<id próprio>` com `ativo:false` → 409 `ALTERACAO_PROPRIA_NAO_PERMITIDA` | US9-9, FR-110 |
| 51 | Com o token **Fluig admin** (passo 2), em Usuários: tirar o papel de administradora da Ana (ok); depois tirar o papel de `dev.admin.local`, agora o único administrador interno ativo | O primeiro funciona; o segundo recebe "O sistema precisa de pelo menos um administrador ativo." | US9-10, FR-110 |
| 52 | Tela de login: `nao.existe` com senha qualquer ×5 e uma 6ª; depois `ana.comum` com senha errada ×5 e uma 6ª | Mesmas mensagens nos dois casos: "Login ou senha incorretos." ×5 e depois bloqueio de 15 min com horário | US8-4/5, FR-104, SC-014 |
| 53 | Admin Local → "Sair"; reaproveitar o token antigo num `curl .../api/fluig/me` | Volta à tela de login; o `curl` recebe 401 | US8-8, FR-105/106 |
| 54 | Abrir `http://localhost:5173/#fluigToken=<token admin Fluig>` na aba da sessão local | Entra como "Admin Dev" (Fluig), **sem** "Sair"/"Trocar senha"; todas as telas funcionam como nos passos 2–38 | US8-9, SC-016 |
| 55 | Token do login próprio em `GET /api/portal/documentos` e token do portal em `GET /api/fluig/me` | 401 nos dois | FR-115 |
| 56 | `select acao, ator_tipo, ator_id, ator_admin, recurso_tipo from auditoria order by id desc limit 30` | Linhas `USUARIO_CRIADO` (primeira com `SISTEMA`/`sistema`), `LOGIN_SUCESSO`/`LOGIN_FALHA`/`LOGIN_BLOQUEADO` com `USUARIO_INTERNO`, `SENHA_TROCADA`, `USUARIO_ATUALIZADO`, `USUARIO_DESATIVADO`, `USUARIO_REATIVADO`, `SENHA_REDEFINIDA`, `SESSAO_ENCERRADA`, `PERMISSAO_NEGADA` com `LOCAL` e `ator_admin=false`; nenhuma coluna com senha | US9-12, FR-113 |

## 7. Verificações visuais

- Montserrat carregada; botões primários `#DF1A1A`, links `#BD1E1B`, títulos com barra vermelha
  50×6 px; painel de login do portal com canto `20px 0`.
- Selos de situação sempre com texto (Pendente de envio / Em análise / Aprovado / Rejeitado) nas
  cores de `docs/design.md` §3.4.
- `fluig-app` sem cabeçalho de marca; portal com cabeçalho `#F2F2F2`, logo, razão social e "Sair".
- Tela de login próprio do `fluig-app`: painel com canto `20px 0` (`--jn-radius-signature`), logo da
  Jotanunes dentro do painel, título com Montserrat, botão pill "Acessar" `#DF1A1A`, mensagens de erro
  associadas aos campos; em 360 px sem rolagem horizontal.
- Em 360 px de largura: sem rolagem horizontal da página no portal; tabelas do `fluig-app` com
  rolagem interna.
- Contraste: conferir no DevTools (Lighthouse/axe) — nenhum alerta de contraste (SC-007).
