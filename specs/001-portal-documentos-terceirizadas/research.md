# Research — Portal de Documentação de Terceirizadas Jotanunes

**Feature**: `001-portal-documentos-terceirizadas` | **Data**: 2026-09-28

Decisões técnicas da Fase 0. As escolhas de stack (.NET 8 hexagonal, PostgreSQL 16 + EF Core,
React + Vite + TS sem framework de CSS, Resend) foram dadas pelo usuário e não são reabertas aqui;
este documento resolve os detalhes em aberto.

---

## R1. Identidade Fluig na API (sem login próprio)

- **Decision**: o Fluig emite um **JWT HS256** assinado com um segredo compartilhado e o entrega ao
  `fluig-app`; o `fluig-app` envia `Authorization: Bearer <token>` em toda chamada a `/api/fluig/*`.
  Claims obrigatórias:

  | Claim | Valor |
  |---|---|
  | `iss` | `fluig` (configurável: `Auth__Fluig__Issuer`) |
  | `aud` | `jotanunes-docs-api` (configurável: `Auth__Fluig__Audience`) |
  | `sub` | login do usuário no Fluig |
  | `name` | nome do usuário |
  | `email` | e-mail do usuário |
  | `iat`, `exp` | emissão e expiração; `exp - iat` ≤ 8 h; tolerância de relógio 2 min |

  Entrega ao front: o widget/página do Fluig abre o `fluig-app` (iframe ou nova aba) com o token no
  **fragmento** da URL (`https://.../fluig-app/#fluigToken=<jwt>`). O fragmento não vai para
  servidores nem logs de acesso. O `fluig-app` lê o fragmento, remove-o com `history.replaceState` e
  guarda o token em memória + `sessionStorage` (chave `jn.fluigToken`). Sem token válido → tela
  "Abra este sistema pelo Fluig.".

  Geração no Fluig (responsabilidade da integração, fora deste repositório): dataset customizado ou
  serviço REST do Fluig que lê o usuário logado (`getValue("WKUser")`/API `users/getCurrent`) e
  assina o JWT com o segredo guardado no Fluig. Documentado em
  [`contracts/fluig-identity.md`](contracts/fluig-identity.md).

- **Porta/adaptador (troca fácil)**:
  - `Application` só conhece `IUsuarioFluigAtual { Login, Nome, Email }`.
  - `Api` registra o esquema de autenticação **`Fluig`** (hoje `JwtBearer` HS256) e um adaptador
    `UsuarioFluigAtualDeClaims` que lê as claims.
  - Para trocar (RS256/JWKS do Fluig, OAuth do Fluig, validação da sessão via API REST do Fluig),
    basta substituir o handler do esquema `Fluig` mantendo as mesmas claims; nenhum caso de uso muda.

- **Desenvolvimento**: `scripts/gerar-token-fluig-dev.mjs` (Node, sem dependências) gera um token
  com o segredo de `FLUIG_JWT_SECRET` (lido do `.env`), login `dev.analista`, validade 8 h. O
  `fluig-app` em modo dev aceita `VITE_FLUIG_DEV_TOKEN` quando não há fragmento na URL.

- **Rationale**: HS256 é simples de gerar no Fluig (Java/JS server-side) e de validar no .NET; o
  fragmento evita vazamento em logs; o esquema isolado garante que token do portal não sirva aqui.
- **Alternatives considered**: (a) OAuth 1.0 do Fluig + chamada à API do Fluig a cada requisição —
  acopla a API à disponibilidade do Fluig e complica o dev; (b) RS256 com JWKS — melhor para
  produção, mas exige infraestrutura de chaves no Fluig; fica como evolução via o mesmo adaptador;
  (c) confiar em header `X-Fluig-User` sem assinatura — inseguro.

## R2. Autenticação do portal (CNPJ + senha)

- **Decision**: `POST /api/portal/auth/login` valida CNPJ + senha e devolve um **JWT HS256 próprio**
  (segredo `Auth__Portal__Secret`, `iss=jotanunes-docs-portal`, `aud=jotanunes-docs-portal`,
  validade 8 h). Claims: `sub` = id da empresa, `cnpj`, `ver` = `versao_credencial` da empresa,
  `troca_senha` = `true|false`.
  - A cada requisição autenticada, o evento `OnTokenValidated` confere no banco se a empresa está
    ativa e se `ver` bate com `versao_credencial` (incrementado ao trocar senha, reenviar convite ou
    desativar). Isso revoga sessões antigas imediatamente (custo: 1 consulta por PK).
  - Política `PortalCompleto` exige `troca_senha=false`. Com `troca_senha=true` só respondem
    `GET /api/portal/me` e `POST /api/portal/auth/trocar-senha`; o resto → `403 TROCA_SENHA_OBRIGATORIA`.
  - Front guarda o token em memória + `sessionStorage` (`jn.portalToken`); "Sair" apaga localmente.
- **Separação dos esquemas**: políticas `Fluig` e `Portal` com `AuthenticationSchemes` explícitos;
  segredos, emissor e audiência diferentes. Testes cruzados obrigatórios (token Fluig no portal e
  vice-versa → 401).
- **Rationale**: stateless, simples para SPA, revogação garantida pelo `ver`.
- **Alternatives considered**: cookie httpOnly + CSRF (mais seguro contra XSS, mas exige mesmo site
  ou CORS com credenciais; reavaliar no deploy); refresh token (desnecessário com sessão de 8 h).

## R3. Senhas

- **Decision**: `BCrypt.Net-Next`, work factor 12, atrás da porta `IHasherSenha`. Senha temporária:
  12 caracteres de `RandomNumberGenerator` sobre alfabeto sem ambíguos
  (`ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789`), garantindo letra e número. Política
  da nova senha: ≥ 8 e ≤ 128 caracteres, ao menos 1 letra e 1 número, diferente da atual.
- **Bloqueio**: `tentativas_falhas` e `bloqueado_ate` na empresa; 5 falhas → bloqueio de 15 min;
  sucesso zera. CNPJ inexistente executa um BCrypt "dummy" para igualar o tempo de resposta.
- **Alternatives considered**: ASP.NET Identity `PasswordHasher` (PBKDF2) — válido, mas o usuário
  sugeriu BCrypt e Identity traz modelo de usuário que não usamos.

## R4. Convite

- **Decision**: cada convite gera (1) token de 32 bytes aleatórios em base64url, guardado só como
  SHA-256 hex; (2) nova senha temporária (hash BCrypt na empresa, `troca_senha_obrigatoria=true`,
  `senha_temporaria_expira_em = agora + 7 dias`); (3) incrementa `versao_credencial`; (4) marca
  convites anteriores como `substituido_em = agora`. Link: `{Portal__BaseUrl}/acesso?convite=<token>`.
  - `GET /api/portal/convites/{token}` (anônimo, com rate limit) devolve CNPJ e razão social para
    pré-preencher a tela, ou `404 CONVITE_INVALIDO` se não existe/expirou/usado/substituído.
  - O convite é marcado `usado_em` quando a empresa troca a senha pela primeira vez.
  - Login com senha temporária vencida → `401 CONVITE_EXPIRADO`.
  - Ordem transacional: grava convite e credenciais → envia e-mail → commit. Se o envio falhar,
    rollback e `502 EMAIL_FALHOU` (a situação da empresa não muda).
- **Rationale**: token só como hash evita uso em caso de vazamento do banco; o reenvio é também o
  mecanismo de recuperação de senha.

## R5. E-mail (Resend)

- **Decision**: porta `IEnviadorEmail.EnviarAsync(MensagemEmail)`; adaptadores:
  - `ResendEnviadorEmail`: `HttpClient` tipado, `POST https://api.resend.com/emails`,
    `Authorization: Bearer {Resend__ApiKey}`, corpo `{from, to, subject, html, text}`; timeout 10 s;
    resposta não-2xx → exceção `FalhaEnvioEmail`.
  - `LogEnviadorEmail`: usado quando `Resend__ApiKey` está vazio; registra destinatário, assunto e
    corpo texto no log (nível Information) — é assim que o dev/teste pega o link e a senha
    temporária. **Só em Development**; em Production sem chave a API não sobe.
  - Testes usam `EnviadorEmailFake` que guarda as mensagens em memória.
- Templates (HTML simples com tokens de cor inline + versão texto) montados na `Application`
  (`ModelosEmail`): convite e rejeição, com o tom de voz de `docs/design.md` §9.
- Rejeição: falha no e-mail só gera log de aviso; a decisão não é desfeita.
- Configuração: `Resend__ApiKey`, `Resend__From` (ex.: `Jotanunes <documentos@jotanunes.com>`),
  nunca commitados; `.env.example` só com nomes.

## R6. Armazenamento de arquivos

- **Decision**: porta `IArmazenamentoArquivos { SalvarAsync(chave, stream), AbrirLeituraAsync(chave),
  ExcluirAsync(chave) }`. Adaptador `ArmazenamentoDiscoLocal` com raiz `Storage__Root`
  (padrão `backend/.data/uploads`, ignorado pelo git). Chave: `empresas/{empresaId:N}/{envioId:N}`
  (sem nome original nem extensão — evita path traversal e execução). Nome original, content type,
  tamanho e SHA-256 ficam no banco.
- **Formatos**: PDF, JPEG, PNG (decisão do clarify). Validação por **assinatura de bytes**:
  PDF `25 50 44 46 2D` (`%PDF-`), PNG `89 50 4E 47 0D 0A 1A 0A`, JPEG `FF D8 FF`. O content type
  gravado é o detectado, não o informado pelo cliente. Arquivo de 0 byte → `400 ARQUIVO_INVALIDO`.
- **Tamanho**: 10 MB (10.485.760 bytes). `[RequestSizeLimit(11 MB)]` + `MultipartBodyLengthLimit`
  no endpoint; acima → `413 ARQUIVO_MUITO_GRANDE`.
- **Download**: só por endpoint autenticado, com `Content-Disposition: attachment; filename*=UTF-8''...`
  (nome saneado), `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`. Os fronts baixam via
  `fetch` com Bearer → `Blob` → `URL.createObjectURL`.
- **Evolução**: adaptador S3-compatível (MinIO/AWS) implementando a mesma porta; nenhum caso de uso
  muda. Ordem de gravação: arquivo primeiro, depois registro no banco; se o banco falhar, o arquivo é
  excluído (melhor esforço) — órfãos são aceitáveis na v1.
- **Alternatives considered**: `bytea` no Postgres (incha backup e memória); MinIO já no compose
  (complexidade sem necessidade na v1).

## R7. Formato de erro

- **Decision**: `application/problem+json` (RFC 9457) com extensões `code` (enum estável, ver
  `openapi.yaml#/components/schemas/CodigoErro`), `errors` (mapa campo → mensagens, só em
  `VALIDACAO`) e `traceId`. `title`/`detail` em português, prontos para exibir. Recurso de outra
  empresa → `404 NAO_ENCONTRADO` (nunca 403, para não revelar existência).

## R8. Persistência

- **Decision**: EF Core 8 + `Npgsql.EntityFrameworkCore.PostgreSQL` 8 + `EFCore.NamingConventions`
  (snake_case). Migrations no projeto `Infrastructure`; aplicadas no startup quando
  `Database__MigrateOnStartup=true` (dev/test). IDs `uuid` gerados na aplicação com `Guid.NewGuid()`
  (exceto `auditoria`, `bigint` identity). Datas
  `timestamptz` em UTC; fronts exibem em `America/Sao_Paulo`.
- **Concorrência na análise**: `ExecuteUpdateAsync(... WHERE id = @id AND status = 'EM_ANALISE')`;
  0 linhas → `409 ENVIO_JA_ANALISADO`.
- **Concorrência no envio**: índice único parcial `envios_documento(empresa_id, tipo_documento_id)
  WHERE status <> 'REJEITADO'` — garante no máximo um envio "vivo" (em análise ou aprovado) por
  empresa × tipo; violação → `409 ENVIO_NAO_PERMITIDO`.
- **Unicidade case-insensitive**: índice único em `lower(nome)` para tipos de documento e em
  `upper(codigo)` para obras.

## R9. CNPJ (numérico e alfanumérico)

- **Decision**: normalizar removendo `.`, `/`, `-` e espaços, converter para maiúsculas; validar
  `^[0-9A-Z]{12}[0-9]{2}$`, rejeitar 14 caracteres iguais; DV pelo módulo 11 com pesos 5..2,9..2 e
  valor de cada caractere = `código ASCII − 48` (regra da Receita para o CNPJ alfanumérico, vigente
  desde jul/2026; compatível com o numérico). Armazenar `char(14)`. Exibir com máscara
  `XX.XXX.XXX/XXXX-XX`. Value object `Cnpj` no `Domain` com testes para os dois formatos.

## R10. Frontends

- **Decision**: React 18 + Vite 5 + TypeScript 5 (strict), `react-router-dom` 6 (roteamento, não é
  CSS). `fluig-app` usa `HashRouter` (roda em iframe/caminho do Fluig sem rewrite de servidor);
  `portal` usa `BrowserRouter`.
- **Tipos da API**: `openapi-typescript` gera `src/api/schema.d.ts` a partir de
  `../specs/001-portal-documentos-terceirizadas/contracts/openapi.yaml` (script `npm run gen:api`,
  arquivo gerado é commitado). Cliente `fetch` fino e tipado em `src/api/client.ts`.
- **Mocks**: MSW 2 (`src/mocks/handlers.ts`) com respostas conformes ao contrato; ligados por
  `VITE_USE_MOCKS=true` no dev e sempre nos testes (`msw/node`). Permite desenvolver os fronts antes
  do backend.
- **Estilo**: CSS puro. `src/styles/tokens.css` (cópia dos tokens de `docs/design.md` §10),
  `base.css` e CSS por componente (`Componente.css` importado no componente, com prefixo de classe
  `jn-`). No `fluig-app`, tudo sob `.jn-app` (raiz) para não vazar/herdar do tema Fluig. Ícones: SVG
  inline em `src/components/icons/` (traço, estilo Lucide), sem biblioteca. Montserrat via Google
  Fonts (`<link>` no `index.html`).
- **Proibido**: Tailwind, Bootstrap, MUI, Chakra, Ant, styled-components, Emotion, CSS Modules com
  libs de terceiros, bibliotecas de componentes visuais.
- **Testes**: Vitest + `@testing-library/react` + `@testing-library/user-event` + `jsdom` + MSW.

## R11. Proteções de borda

- **Decision**: `Microsoft.AspNetCore.RateLimiting` (nativo): janela fixa de 10 req/min por IP em
  `POST /api/portal/auth/login` e `GET /api/portal/convites/{token}` → `429 LIMITE_REQUISICOES`.
  CORS com origens de `Cors__Origins` (dev: `http://localhost:5173,http://localhost:5174`), só
  header `Authorization`/`Content-Type`, sem credenciais. Headers de segurança padrão na API.
- **Fluig em iframe**: em produção, o servidor que hospedar o `fluig-app` deve enviar
  `Content-Security-Policy: frame-ancestors <domínio do Fluig>`; fora do escopo do dev local.

## R12. Auditoria e logs

- **Decision**: porta `IRegistroAuditoria`; tabela `auditoria` gravada na mesma transação do caso de
  uso. Ações: `LOGIN_SUCESSO`, `LOGIN_FALHA`, `LOGIN_BLOQUEADO`, `SENHA_TROCADA`, `CONVITE_ENVIADO`,
  `DOCUMENTO_ENVIADO`, `ARQUIVO_BAIXADO`, `ENVIO_APROVADO`, `ENVIO_REJEITADO`. Logs estruturados
  (`ILogger`, console JSON em produção) sem senhas, tokens, corpo de e-mail em produção ou conteúdo de
  arquivos. Não há tela de auditoria na v1 (consulta direta no banco).

## R13. Testes do backend

- **Decision**: xUnit + `Microsoft.AspNetCore.Mvc.Testing` (`WebApplicationFactory`) +
  `Testcontainers.PostgreSql` (Postgres 16 real, Docker disponível) + `EnviadorEmailFake` +
  armazenamento em diretório temporário + `FakeTimeProvider`
  (`Microsoft.Extensions.TimeProvider.Testing`). Asserções com `Assert` do xUnit (sem
  FluentAssertions, que mudou de licença). Projetos: `Jotanunes.Docs.Domain.Tests` (unitários),
  `Jotanunes.Docs.Application.Tests` (casos de uso com fakes), `Jotanunes.Docs.Api.Tests`
  (integração + contrato + autorização). Helper de testes gera tokens Fluig e portal.
- **Contrato**: teste que carrega `openapi.yaml` (`Microsoft.OpenApi.Readers`) e verifica que cada
  rota/método do contrato está mapeada na API (e vice-versa).

## R14. Relógio, paginação e convenções

- `TimeProvider` (.NET 8) injetado — testável.
- Paginação: `pagina` (≥1, padrão 1), `tamanhoPagina` (1–100, padrão 20); resposta
  `{ itens, total, pagina, tamanhoPagina }`. Tipos de documento e listas de detalhe não paginam.
- JSON camelCase, enums como string em MAIÚSCULAS, datas ISO 8601 UTC.
- Portas locais: API `http://localhost:5080`, `fluig-app` `5173`, `portal` `5174`, Postgres `5432`.
