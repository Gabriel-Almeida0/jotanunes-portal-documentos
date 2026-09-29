# 6. Testes

Este capítulo identifica defeitos no sistema, valida suas funções, verifica se os requisitos foram implementados de forma adequada e avalia a qualidade do software. Os testes foram obrigatórios desde o início (princípio IV da constituição do projeto): cada tarefa de implementação foi acompanhada dos seus testes automatizados, e cada fase terminou com a execução de um roteiro manual de ponta a ponta (E2E).

## 6.1. Plano de Testes

A estratégia combina cinco níveis de teste, todos repetíveis:

| Nível | Ferramentas | Onde está | O que verifica |
|---|---|---|---|
| Unitário do domínio | xUnit | `backend/tests/Jotanunes.Docs.Domain.Tests` (104 testes) | Validações das entidades, CNPJ, máquinas de estado, situação de acesso, política de senha, regras do usuário interno e regra de dependência entre camadas |
| Unitário da aplicação | xUnit | `backend/tests/Jotanunes.Docs.Application.Tests` (42 testes) | Situação do documento, detector de formato de arquivo, catálogo padrão de tipos e adaptador do Resend (com servidor HTTP simulado) |
| Integração da API | xUnit, `WebApplicationFactory`, Testcontainers (PostgreSQL 16 real e descartável) | `backend/tests/Jotanunes.Docs.Api.Tests` (321 testes) | Todas as rotas via HTTP com banco real: cadastros, convites, portal, envio, análise, painel, usuários internos, autenticação, autorização por perfil, isolamento entre empresas, logs, configuração, proxy reverso e desempenho |
| Contrato | xUnit + Microsoft.OpenApi.Readers | `Contrato/ContratoOpenApiTests.cs` | A API implementa exatamente o `openapi.yaml`: 43 operações, rotas, `operationId`, enumerados, esquemas dos DTOs, títulos de erro e operações de administrador |
| Interface (componentes e telas) | Vitest, Testing Library, jsdom, MSW | `fluig-app/src/**/*.test.tsx` (190 testes) e `portal/src/**/*.test.tsx` (71 testes) | Comportamento das telas com a API simulada pelo contrato: estados de carregamento, vazio e erro, mensagens, perfis, formulários, validações e navegação |
| Ponta a ponta (E2E) manual | Navegador, `curl`, `psql` | `specs/001-portal-documentos-terceirizadas/quickstart.md`, seção 6 (56 passos) | Fluxos completos com API, área Jotanunes, portal e banco executando juntos |

Os casos de teste do plano estão relacionados a seguir. Os testes de 1 a 32 são automatizados; os de 33 a 40 correspondem a grupos de passos do roteiro E2E manual.

| Nº | Descrição do teste | Resultado esperado |
|---|---|---|
| 1 | Validar CNPJ numérico e alfanumérico (dígitos verificadores, máscara, tamanho) | CNPJs válidos aceitos e normalizados; inválidos recusados com mensagem no campo |
| 2 | Cadastrar obra, empresa e tipo de documento com dados inválidos (tamanhos, UF, e-mail, telefone) | `400 VALIDACAO` com erros por campo |
| 3 | Cadastrar empresa com CNPJ já existente, obra com código repetido e tipo com nome repetido (maiúsculas diferentes) | `409 CNPJ_DUPLICADO`, `CODIGO_OBRA_DUPLICADO` e `NOME_DUPLICADO` |
| 4 | Alterar o CNPJ de empresa já convidada | `409 CNPJ_IMUTAVEL` |
| 5 | Vincular a mesma empresa duas vezes à obra; desvincular | Vínculo idempotente (sem duplicar); desvínculo não altera documentos |
| 6 | Enviar convite com o Resend aceitando e com o Resend falhando | Convite válido e e-mail enviado; na falha, `502 EMAIL_FALHOU` e nada gravado |
| 7 | Reenviar convite | Convite anterior substituído, nova senha temporária, sessões anteriores revogadas |
| 8 | Validar convite por `POST` com token válido, usado, expirado, substituído e inexistente | Só o válido retorna os dados; os demais `CONVITE_INVALIDO`; token não aparece em logs |
| 9 | Login do portal com senha temporária e troca obrigatória | Token com `troca_senha=true`; rotas de documentos respondem `403 TROCA_SENHA_OBRIGATORIA` até a troca |
| 10 | Trocar senha com senha atual errada, senha fraca e senha igual à atual | `SENHA_ATUAL_INCORRETA` e `SENHA_FRACA` |
| 11 | Cinco senhas erradas e sexta tentativa, com CNPJ existente e inexistente | Mesmas respostas `401` ×5 e `423 ACESSO_BLOQUEADO` com horário de liberação nos dois casos |
| 12 | Login de empresa desativada e de senha temporária vencida | Recusa com mensagem própria e registro `LOGIN_FALHA` na auditoria |
| 13 | Listar "Meus documentos" | Todos os tipos ativos, ordenados (rejeitados, pendentes, em análise, aprovados), com `podeEnviar` correto |
| 14 | Enviar PDF, JPG e PNG válidos | `201`, envio "Em análise" com nome, tamanho e SHA-256 |
| 15 | Enviar arquivo renomeado (ex.: executável como `.pdf`), arquivo truncado, arquivo vazio e arquivo acima de 10 MB | `415 ARQUIVO_TIPO_NAO_SUPORTADO`, `400 ARQUIVO_INVALIDO` e `413 ARQUIVO_MUITO_GRANDE` |
| 16 | Enviar de novo documento em análise ou aprovado; envios simultâneos | `409 ENVIO_NAO_PERMITIDO`; índice parcial garante um único envio vivo |
| 17 | Empresa B acessar documento, histórico ou arquivo da empresa A | `404` em todas as rotas; nenhum dado da empresa A exposto |
| 18 | Token do portal nas rotas da área Jotanunes e tokens da área Jotanunes nas rotas do portal | `401` em todos os casos |
| 19 | Token do Fluig expirado, com segredo, emissor ou audiência errados, `alg=none` ou validade acima de 8 horas | `401 NAO_AUTENTICADO` |
| 20 | Fila de análise com filtros por obra, empresa e tipo | Envios em análise, mais antigos primeiro, paginados |
| 21 | Aprovar e rejeitar (sem motivo, motivo curto, motivo válido) | Aprovação gravada; rejeição exige motivo de 5 a 500 caracteres e dispara e-mail |
| 22 | Aprovar o mesmo envio duas vezes ao mesmo tempo | Uma decisão aceita e a outra `409 ENVIO_JA_ANALISADO` |
| 23 | Falha no e-mail de rejeição | Decisão mantida; aviso registrado no log |
| 24 | Usuário comum chamar cada operação de administrador | `403 SEM_PERMISSAO` antes de qualquer efeito e linha `PERMISSAO_NEGADA` na auditoria |
| 25 | Perfil lido da claim `roles` (lista, texto, ausente, tipos inesperados) | Somente `"admin"` textual resulta em administrador |
| 26 | Catálogo padrão com banco vazio e em reinícios da API (inclusive instâncias simultâneas) | 10 tipos criados uma única vez; não duplicam nem reativam |
| 27 | Login próprio: sucesso, login inexistente, senha errada, usuário desativado, senha provisória vencida, bloqueio | Respostas iguais para inexistente e senha errada; bloqueio após 5 falhas; auditoria correta |
| 28 | Revogação do login próprio ao desativar, mudar papel, redefinir senha, trocar senha e sair | Token antigo passa a receber `401` imediatamente |
| 29 | Gestão de usuários internos: login duplicado, alterar a si mesmo, remover o último administrador | `LOGIN_DUPLICADO`, `ALTERACAO_PROPRIA_NAO_PERMITIDA` e `ULTIMO_ADMINISTRADOR` |
| 30 | Comando `criar-admin` (primeira execução, repetição, `--forcar`, login próprio desligado) | Códigos de saída 0, 2 e 1; senha provisória só no terminal, nunca no log |
| 31 | Contrato OpenAPI × API; logs sem segredos; configuração inválida; IP real atrás do proxy; listas com 20.000 envios | Contrato idêntico; nenhum segredo em log; API não sobe com configuração insegura; IP do cliente na auditoria; listas abaixo de 2 s |
| 32 | Testes de interface das duas SPAs (formulários, mensagens, perfis, estados vazios e de erro, troca de parâmetro de rota) | Telas se comportam conforme o contrato simulado |
| 33 | E2E – acesso sem token e com token do Fluig (passos 1–2) | Tela de login próprio (ou "Abra este sistema pelo Fluig.") sem dados; com token, painel com o nome do usuário |
| 34 | E2E – cadastros, catálogo padrão e vínculos (passos 3–8) | 10 tipos padrão; duplicidades recusadas; CNPJ alfanumérico aceito; vínculos sem duplicar |
| 35 | E2E – convite, primeiro acesso, envio e recusas de arquivo (passos 9–20) | Fluxo completo da terceirizada; isolamento (404) e separação de tokens (401) confirmados |
| 36 | E2E – análise, rejeição com e-mail, reenvio, histórico e concorrência (passos 21–25) | Situações e histórico corretos; segunda aprovação recusada |
| 37 | E2E – bloqueio, reenvio de convite, desativação, novo tipo e painel (passos 26–30) | Bloqueio de 15 minutos; sessão derrubada; contagens do painel coerentes |
| 38 | E2E – perfis administrador e comum e auditoria (passos 31–38) | Usuário comum sem ações de administrador na tela e com `403` na API; auditoria com `ator_admin` |
| 39 | E2E – login próprio e usuários internos (passos 39–53) | `criar-admin`, troca obrigatória, gestão de usuários, revogação imediata, último administrador e bloqueio sem enumeração |
| 40 | E2E – convivência com o Fluig, separação de tokens e trilha de auditoria (passos 54–56) | Token do Fluig substitui a sessão local; tokens cruzados recusados; auditoria completa e sem senhas |

## 6.2. Execução do Plano de Testes

**Identificação do sistema**: Portal de Documentação de Terceirizadas Jotanunes (API `Jotanunes.Docs`, área Jotanunes `fluig-app` e portal da terceirizada), versão do contrato 1.2.0.

**Realizador dos testes**: Squad 81 — agentes de IA orquestrados e revisão.

**Configuração do ambiente**:

- Testes automatizados: estação macOS (Darwin 25), .NET SDK 8.0.425, Node.js 22.23, Docker em execução (o Testcontainers sobe um PostgreSQL 16 descartável por execução). Comandos: `dotnet test` em `backend/` e `npm test` em `fluig-app/` e `portal/`.
- Roteiro E2E: PostgreSQL 16 em contêiner (`docker compose`), API em `http://localhost:5080`, área Jotanunes em `http://localhost:5173` e portal em `http://localhost:5174`, navegador Google Chrome, `curl` e `psql`; e-mails registrados no log da API (adaptador de desenvolvimento). O roteiro foi executado em três etapas, ao final de cada fase: passos da integração inicial (tarefa T116), da fase de perfis e catálogo padrão (T145) e da fase de login próprio (T176).

**Resultado consolidado da execução automatizada (29/09/2026)**:

| Suíte | Testes | Aprovados | Falhas | Duração |
|---|---|---|---|---|
| Backend – Domain | 104 | 104 | 0 | menos de 1 s |
| Backend – Application | 42 | 42 | 0 | menos de 1 s |
| Backend – Api (integração, com PostgreSQL real) | 321 | 321 | 0 | 1 min 11 s |
| fluig-app (27 arquivos de teste) | 190 | 190 | 0 | 5,7 s |
| portal (9 arquivos de teste) | 71 | 71 | 0 | 2,5 s |
| **Total** | **728** | **728** | **0** | — |

Registro por caso de teste:

| Nº | Resultado obtido | Comentários |
|---|---|---|
| 1 | Aprovado | Inclui o CNPJ alfanumérico previsto pela Receita Federal |
| 2 | Aprovado | — |
| 3 | Aprovado | Unicidade garantida também por índices no banco |
| 4 | Aprovado | — |
| 5 | Aprovado | — |
| 6 | Aprovado | Ordem grava → envia e-mail → confirma |
| 7 | Aprovado | — |
| 8 | Aprovado | Validação passou de `GET` com o token no caminho para `POST` com o token no corpo (ver problemas corrigidos) |
| 9 | Aprovado | — |
| 10 | Aprovado | — |
| 11 | Aprovado | A primeira versão revelava se o CNPJ existia; corrigido na convergência (ver abaixo) |
| 12 | Aprovado | Registro de auditoria acrescentado na convergência |
| 13 | Aprovado | — |
| 14 | Aprovado | — |
| 15 | Aprovado | Recusa de arquivo truncado acrescentada na convergência |
| 16 | Aprovado | — |
| 17 | Aprovado | — |
| 18 | Aprovado | — |
| 19 | Aprovado | — |
| 20 | Aprovado | — |
| 21 | Aprovado | — |
| 22 | Aprovado | Concorrência resolvida por atualização condicional |
| 23 | Aprovado | — |
| 24 | Aprovado | 10 operações de administrador na fase de perfis, ampliadas com as de usuários internos |
| 25 | Aprovado | — |
| 26 | Aprovado | Trava exclusiva do PostgreSQL evita duplicidade com várias instâncias |
| 27 | Aprovado | — |
| 28 | Aprovado | — |
| 29 | Aprovado | — |
| 30 | Aprovado | — |
| 31 | Aprovado | Teste de desempenho com 20.000 envios |
| 32 | Aprovado | Inclui 10 testes de regressão para os defeitos de navegação corrigidos |
| 33 | Aprovado | — |
| 34 | Aprovado | — |
| 35 | Aprovado | — |
| 36 | Aprovado | — |
| 37 | Aprovado | — |
| 38 | Aprovado | — |
| 39 | Aprovado | — |
| 40 | Aprovado | — |

**Problemas encontrados e corrigidos.** Os defeitos a seguir foram identificados durante os roteiros E2E, a revisão de integração e a etapa de convergência (comparação do código com a especificação, o plano e a constituição) e foram corrigidos antes da entrega, cada um com testes de regressão:

| Problema encontrado | Correção |
|---|---|
| Quando o Fluig entregava um token novo trocando apenas o fragmento do endereço (renovação no mesmo *iframe*), a área Jotanunes não lia o token sem recarregar a página | O token passou a ser lido, conferido e retirado do endereço e do histórico ao mudar o fragmento, sem perder a rota |
| Ao navegar de um detalhe para outro do mesmo tipo (ex.: envio A para envio B), a tela era reaproveitada com modais e formulários da entidade anterior; um modal de aprovação aberto no envio A podia aprovar o envio B | As telas de detalhe de obra, empresa e envio passaram a ser remontadas quando o identificador muda |
| A validação do convite era feita por `GET` com o token no caminho da URL, o que o expunha em logs de proxy e no histórico do navegador | Troca para `POST /api/portal/convites/validar` com o token no corpo; o portal retira `?convite=` do endereço antes da chamada |
| O bloqueio após 5 tentativas só existia para CNPJs cadastrados, o que permitia descobrir se um CNPJ existia pela sequência de respostas | Contador por HMAC para CNPJs sem cadastro e verificação BCrypt fictícia para igualar também o tempo de resposta |
| Arquivos com cabeçalho válido, mas truncados, eram aceitos; recusas de login de empresa inativa não entravam na auditoria | Verificação estrutural do final do arquivo e registro `LOGIN_FALHA` nesses casos |
| A *connection string* do arquivo `launchSettings.json` sobrescrevia a configuração de ambiente | Passou a ser configurável pelo ambiente (arquivo `.env`) |
| Atrás do nginx, a API via todos os clientes como `127.0.0.1`: o limite de requisições por IP ficava compartilhado entre todas as empresas e a auditoria gravava o IP errado | A API passou a aceitar `X-Forwarded-For` e `X-Forwarded-Proto` somente quando a conexão vem do proxy local |
| Na preparação da publicação, verificou-se que a configuração de produção podia herdar os segredos de assinatura de tokens do ambiente de desenvolvimento | O script de publicação passou a ler os segredos exclusivamente de um arquivo de produção fora do controle de versão, parando com mensagem clara se faltar algum ou se forem fracos ou repetidos; o arquivo de configuração de desenvolvimento deixou de ser publicado |
| O remetente de e-mail sem aspas no arquivo de ambiente era lido incorretamente | O modelo `.env.example` passou a orientar o uso de aspas |
| Uma descrição no contrato OpenAPI tornava o YAML inválido | Descrição corrigida e tipos dos fronts regenerados |

Não há defeitos conhecidos em aberto. Ficam como pontos de atenção para a próxima etapa a integração real com o Fluig (hoje validada com tokens gerados pelo script de teste com o mesmo formato e segredo) e testes de carga com volume real de uso.
