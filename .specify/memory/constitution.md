<!--
Sync Impact Report
- Versão: 1.0.1 → 1.1.0 (MINOR, 2026-09-29: perfis na área Jotanunes. Princípio III ganha regra
  nova: operações restritas a administrador são autorizadas NO SERVIDOR a partir do papel vindo do
  Fluig, com 403 sem efeito de negócio e com a tentativa auditada; esconder na interface não basta. Princípio IV
  exige teste que percorra todas as rotas de escrita com os dois perfis. "Fluxo de Desenvolvimento"
  define como marcar decisões validadas pelo usuário. Motivo: decisão do dono do produto que
  substitui a suposição "todos os usuários Fluig têm as mesmas permissões".)
  - Princípios modificados: III (expandido), IV (expandido); nenhum removido/redefinido
  - Seções modificadas: Fluxo de Desenvolvimento e Portões de Qualidade
  - Templates revisados: plan-template.md (✅ Constitution Check genérico), spec-template.md (✅),
    tasks-template.md (✅) — sem alteração necessária
  - Artefatos da feature 001 atualizados: spec.md, plan.md (Constitution Check re-check),
    research.md (R16), tasks.md (Phase 10)
  - TODOs pendentes: nenhum
- Histórico: (template sem versão) → 1.0.0 → 1.0.1 (PATCH, 2026-09-28: exceção explícita no
  princípio III para o adaptador de e-mail de desenvolvimento que registra o e-mail no log — decisão
  do usuário que conflitava com a regra de logs; apontada pelo /speckit-analyze)
- Princípios definidos (novos): I. Arquitetura Hexagonal no Backend; II. Contrato de API como Fonte
  de Verdade; III. Segurança, Isolamento e LGPD; IV. Testes Obrigatórios; V. Identidade Visual
  Jotanunes sem Frameworks de CSS; VI. Simplicidade e Adaptadores Trocáveis
- Seções adicionadas: Restrições Técnicas; Fluxo de Desenvolvimento e Portões de Qualidade; Governança
- Seções removidas: nenhuma
- Templates revisados: plan-template.md (✅ "Constitution Check" genérico, lido em tempo de execução),
  spec-template.md (✅ sem alteração necessária), tasks-template.md (✅ sem alteração necessária)
- TODOs pendentes: nenhum
-->

# Portal de Documentação de Terceirizadas Jotanunes — Constituição

## Core Principles

### I. Arquitetura Hexagonal no Backend

O backend DEVE ser .NET 8 (ASP.NET Core) organizado em quatro projetos: `Domain`, `Application`,
`Infrastructure` e `Api`.

- `Domain` NÃO DEVE referenciar nenhum outro projeto nem pacotes de infraestrutura (EF Core, HTTP,
  e-mail, armazenamento).
- `Application` contém casos de uso e declara **portas** (interfaces) para tudo que é externo:
  persistência, e-mail, armazenamento de arquivos, relógio, hash de senha, identidade Fluig.
- `Infrastructure` implementa as portas (**adaptadores**): EF Core/Npgsql, Resend, disco local,
  BCrypt, validação de token Fluig.
- `Api` só faz composição (DI), autenticação/autorização, mapeamento HTTP ↔ casos de uso.

Justificativa: integrações (Fluig, e-mail, storage) ainda vão mudar; a troca deve ser feita
substituindo um adaptador, sem tocar regra de negócio.

### II. Contrato de API como Fonte de Verdade

O arquivo `contracts/openapi.yaml` da feature é o contrato ÚNICO entre `backend/`, `fluig-app/` e
`portal/`.

- Toda rota, schema, código de erro e esquema de autenticação DEVE estar no contrato antes de ser
  implementado.
- Mudança de contrato DEVE ser feita primeiro no `openapi.yaml` e comunicada às três áreas.
- Os frontends DEVEM conseguir evoluir com mocks derivados do contrato, sem depender do backend.
- Erros DEVEM seguir um formato único (`application/problem+json`, RFC 9457) com `code` estável.

Justificativa: três agentes/equipes trabalham em paralelo, cada um restrito à sua pasta.

### III. Segurança, Isolamento e LGPD (INEGOCIÁVEL)

- Uma empresa terceirizada DEVE ver e acessar SOMENTE os próprios dados e documentos. Todo acesso a
  recurso de empresa DEVE filtrar pela empresa do token no servidor — nunca por parâmetro do cliente.
- Rotas do lado Jotanunes DEVEM aceitar apenas a identidade Fluig; rotas do portal DEVEM aceitar
  apenas o token do portal. Tokens de um esquema NÃO DEVEM funcionar no outro.
- Senhas DEVEM ser armazenadas apenas como hash BCrypt (custo ≥ 11). Tokens de convite DEVEM ser
  armazenados apenas como hash (SHA-256), ter expiração e uso único.
- Arquivos enviados NÃO DEVEM ser servidos por URL pública/estática; download SÓ por endpoint
  autenticado e autorizado.
- Segredos (chave Resend, segredo JWT, senha do banco) DEVEM vir de variáveis de ambiente e NUNCA
  ser commitados. Logs NÃO DEVEM conter senhas, tokens nem conteúdo de documentos.
  Única exceção: o adaptador de e-mail de desenvolvimento (sem chave do Resend) PODE registrar no log
  o corpo dos e-mails (link de convite e senha temporária), e DEVE estar habilitado somente no
  ambiente `Development`; fora dele a aplicação não inicia sem chave do Resend.
- Perfis na área Jotanunes (v1.1.0): o papel do usuário (administrador ou comum) DEVE vir somente
  da identidade Fluig assinada — nunca de parâmetro, header livre ou dado guardado pelo cliente — e
  a ausência do papel DEVE significar o perfil de menor privilégio. Toda operação restrita a
  administrador DEVE ser autorizada no servidor (política da `Api`) e marcada no contrato; usuário
  sem o papel DEVE receber 403 com `code` estável antes de qualquer validação, leitura de recurso ou
  efeito de negócio, e a tentativa DEVE ser auditada (o único registro permitido nesse caso). Esconder a ação na interface é complemento de
  usabilidade, NUNCA o controle.

Justificativa: os documentos contêm dados pessoais de trabalhadores (LGPD).

### IV. Testes Obrigatórios

- Backend: xUnit. Regras de domínio DEVEM ter testes unitários; cada endpoint DEVE ter teste de
  integração; isolamento entre empresas e separação dos esquemas de autenticação DEVEM ter testes de
  autorização explícitos (casos negativos).
- Perfis (v1.1.0): DEVE existir teste que enumere TODAS as rotas de escrita da área Jotanunes
  registradas na API e confira, para cada uma, o resultado com o perfil comum (403 ou permitido por
  lista explícita) e com o administrador; rota nova sem classificação DEVE fazer o teste falhar.
- Frontends: Vitest + Testing Library para componentes e fluxos principais.
- Uma tarefa só está concluída com testes passando localmente.

Justificativa: regras de autorização quebradas são silenciosas; só testes negativos as pegam.

### V. Identidade Visual Jotanunes sem Frameworks de CSS

- Os frontends (`fluig-app/`, `portal/`) DEVEM ser React + Vite + TypeScript.
- É PROIBIDO usar qualquer framework ou biblioteca de CSS/componentes visuais (Tailwind, Bootstrap,
  MUI, Chakra, styled-components, Emotion, etc.). Apenas CSS puro com variáveis.
- A UI DEVE seguir `docs/design.md`: tokens `--jn-*`, Montserrat, forma-assinatura `20px 0`,
  contraste WCAG AA, status sempre com texto (nunca só cor), tom de voz próximo e direto.
- O `fluig-app` NÃO DEVE ter cabeçalho de marca próprio e DEVE escopar seus estilos sob `.jn-app`
  para não conflitar com o tema do Fluig.

### VI. Simplicidade e Adaptadores Trocáveis

- Começar pelo mais simples que atende à spec (YAGNI). Sem microserviços, filas ou cache sem
  necessidade demonstrada.
- Toda dependência externa (Fluig, Resend, armazenamento) DEVE ter um adaptador de desenvolvimento
  que funcione sem credenciais (ex.: e-mail só no log, disco local, token de dev).
- O ambiente local DEVE subir com `docker compose up` + comandos documentados no `quickstart.md`.

## Restrições Técnicas

- Backend: .NET 8, ASP.NET Core, EF Core + Npgsql, PostgreSQL 16, migrations versionadas.
- Frontends: React + Vite + TypeScript, CSS puro; testes com Vitest + Testing Library.
- E-mail: Resend (API HTTP). Armazenamento de arquivos atrás da porta `IFileStorage`.
- Estrutura na raiz: `backend/`, `fluig-app/`, `portal/`, `compose.yaml`, `docs/`.
- Idioma: interface, mensagens de erro para o usuário e documentação em português do Brasil.
  Identificadores de código podem ser em inglês.

## Fluxo de Desenvolvimento e Portões de Qualidade

- Fluxo Spec Kit: constitution → specify → clarify → plan → tasks → analyze → implement.
- Cada tarefa é rotulada com uma área (`[BACKEND]`, `[FLUIG]`, `[PORTAL]`, `[INFRA]`) e NÃO DEVE
  exigir edição de arquivos de outra área.
- Portões antes de concluir uma user story: build sem erros, testes da área passando, contrato
  respeitado (respostas conferidas com `openapi.yaml`), checagem de contraste/tokens nas telas.
- Decisões assumidas sem validação do cliente DEVEM ficar registradas na spec como
  "Decisão assumida (a validar com Gustavo/Jotanunes)". Quando o usuário/cliente valida, a spec
  DEVE marcar "VALIDADA" com a data e a sessão de clarificação, sem apagar o registro anterior.

## Governance

- Esta constituição prevalece sobre outras práticas do projeto. Planos e tarefas DEVEM passar pelo
  "Constitution Check" do `plan.md`; violações exigem justificativa na tabela de Complexity Tracking.
- Emendas: alteração proposta por escrito, aprovada pelo responsável técnico, com atualização do
  Sync Impact Report e da versão.
- Versionamento semântico: MAJOR para remoção/redefinição de princípio; MINOR para princípio ou
  seção nova; PATCH para redação.
- Revisões de código DEVEM verificar os princípios III (segurança) e V (sem framework de CSS).

**Version**: 1.1.0 | **Ratified**: 2026-09-28 | **Last Amended**: 2026-09-29
