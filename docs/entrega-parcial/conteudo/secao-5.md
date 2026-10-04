<!-- ANCORA: 5.1 -->

O projeto foi construído com **desenvolvimento orientado a especificação (Spec-Driven Development)** usando o GitHub Spec Kit e o Claude Code. Um agente orquestrador conduziu a conversa com o dono do produto, escreveu os prompts dos agentes especializados, revisou cada entrega, integrou, testou ponta a ponta e fez os commits. Abaixo estão os prompts que mais pesaram no resultado, no formato pedido. Os textos completos ficam no histórico da sessão; aqui está o essencial de cada um.

#### P1 — Transcrição do áudio de requisitos

- **Objetivo:** transformar em texto a conversa gravada com o representante da Jotanunes (4 min 16 s), base de todos os requisitos.
- **Contexto informado:** arquivo de áudio do WhatsApp (.opus); transcrição local com faster-whisper, modelo *medium*, idioma português, filtro de voz (VAD) ligado. Nenhum áudio foi enviado para serviço externo.
- **Saída esperada:** texto com marcação de tempo, salvo em `docs/transcricao.txt`.
- **Problemas encontrados:** nomes próprios saíram errados ("JET News" no lugar de Jotanunes; "fluido" e "WIG" no lugar de Fluig; "esse IPJ" no lugar de CNPJ). Foram corrigidos manualmente e a correção ficou registrada no próprio arquivo.

#### P2 — Identidade visual a partir do site da Jotanunes

- **Objetivo:** gerar um `design.md` com cores, tipografia, componentes e tom de voz da marca.
- **Contexto informado:** site jotanunes.com aberto num navegador controlado (Playwright); leitura do CSS calculado dos elementos (cores mais usadas, fontes, raios de borda, botões, cards) e capturas de tela.
- **Saída esperada:** tokens de design (cores, Montserrat, raio-assinatura `20px 0`), regras de componentes, contraste WCAG medido e adaptação para um portal operacional.
- **Problemas encontrados:** as variáveis globais do tema do site eram as padrão e não eram usadas; os valores reais tiveram de ser lidos de cada componente. O cinza dos títulos do site (#AFB0B1) reprova em contraste (2,2:1), então o portal usa texto escuro.

#### P3 — Especificação completa (Spec Kit: constitution → specify → clarify → plan → tasks → analyze)

- **Objetivo:** produzir constituição, especificação, plano, modelo de dados, contrato OpenAPI e lista de tarefas sem escrever código.
- **Contexto informado:** transcrição, `design.md`, decisões de stack do usuário (.NET 8 hexagonal, PostgreSQL, dois React sem framework de CSS, Resend), instrução de não perguntar no *clarify* (sem humano disponível naquele momento) e registrar cada escolha como "decisão assumida, a validar".
- **Saída esperada:** artefatos em `specs/001-portal-documentos-terceirizadas/`; contrato como fonte única de verdade; tarefas rotuladas por área (`[BACKEND]`, `[FLUIG]`, `[PORTAL]`, `[INFRA]`) para três agentes trabalharem em paralelo sem editar os arquivos uns dos outros.
- **Problemas encontrados:** o *analyze* achou uma contradição crítica (a constituição proibia senha em log, mas o e-mail de desenvolvimento registra a senha temporária no log); foi resolvida com emenda explícita e restrita ao ambiente de desenvolvimento. Também faltavam testes exigidos pela constituição, que viraram tarefas.

#### P4 — Implementação em paralelo por área (3 agentes)

- **Objetivo:** implementar as 116 tarefas: backend + infraestrutura, área Jotanunes (fluig-app) e portal da terceirizada.
- **Contexto informado:** cada agente só podia editar a própria pasta; proibido editar o contrato e o `tasks.md` (o orquestrador marcava as tarefas); proibido commitar; TDD; mocks do contrato (MSW) nos fronts para não depender do backend; aviso explícito de uma armadilha vista em projeto anterior (configuração lida antes da hora, que fazia os testes de integração caírem no banco errado).
- **Saída esperada:** código, testes verdes, relatório com tarefas concluídas, divergências do contrato e comandos para rodar.
- **Problemas encontrados:** nenhum agente invadiu a pasta do outro. O aviso da armadilha funcionou: o backend já nasceu com teste provando que usa o banco do Testcontainers. Divergências pequenas do contrato foram reportadas em vez de "corrigidas por conta própria".

#### P5 — Correções após o teste ponta a ponta (E2E)

- **Objetivo:** corrigir o que a primeira rodada do roteiro E2E (30 passos; o roteiro final acumulado tem 56) revelou.
- **Contexto informado:** descrição de cada defeito com passos de reprodução e causa provável; exigência de teste de regressão que falhe antes e passe depois.
- **Saída esperada:** correção + testes + relatório da causa raiz.
- **Problemas encontrados:** (1) o token do Fluig que chegava pelo `#` sem recarregar a página era ignorado; (2) uma janela de histórico continuava aberta ao trocar de empresa — e, na tela de análise, a mesma falha poderia aprovar o envio errado; (3) o token do convite trafegava no caminho da URL e podia aparecer em logs de proxy — a rota virou POST com o token no corpo.

#### P6 — Convergência (speckit-converge)

- **Objetivo:** comparar o código com especificação, plano e constituição e listar o que faltava.
- **Contexto informado:** fatos já verificados (testes e E2E) para o agente não repetir trabalho; proibição de inventar requisito.
- **Saída esperada:** tarefas novas com requisito e evidência (arquivo e linha).
- **Problemas encontrados:** achou 6 lacunas reais, entre elas uma de segurança — o bloqueio de login permitia descobrir se um CNPJ estava cadastrado (CNPJ desconhecido nunca bloqueava). Todas foram implementadas e testadas.

#### P7 — Perfil administrador, catálogo padrão e login próprio (novas rodadas de requisitos)

- **Objetivo:** incorporar decisões novas do dono do produto: perfis administrador × comum vindos do Fluig; 10 tipos de documento já cadastrados numa instalação nova; e, como a Jotanunes ainda não tem acesso ao Fluig, login próprio com tela de usuários.
- **Contexto informado:** respostas do usuário marcadas como fonte de verdade; regra de que esconder botão na tela não é controle de acesso (403 obrigatório na API e auditado); regras do último administrador e de revogação imediata de sessão.
- **Saída esperada:** atualização incremental dos artefatos (contrato 1.1.0 e 1.2.0, constituição 1.1.0 e 1.2.0) e implementação em paralelo (backend × área Jotanunes).
- **Problemas encontrados:** o contrato gerado tinha um erro de sintaxe YAML (descrição com vírgula sem aspas) e o agente de backend contornou o erro nos testes em vez de corrigi-lo; o orquestrador corrigiu o contrato na origem e removeu o contorno.

#### P8 — Implantação na VPS

- **Objetivo:** publicar o sistema numa VPS que já hospedava outro sistema, sem afetá-lo.
- **Contexto informado:** inspeção somente de leitura antes de qualquer instalação (sistema, portas, painel CloudPanel, nginx, Certbot), aprovação do usuário para a instalação nativa e domínios definidos por ele.
- **Saída esperada:** API como serviço systemd em 127.0.0.1, PostgreSQL local, fronts estáticos, HTTPS e script de publicação reprodutível.
- **Problemas encontrados:** (1) envio por senha via script travou — trocado por uma chave SSH dedicada; (2) a configuração de produção foi montada carregando o arquivo de desenvolvimento por último e a API subiu com segredos de desenvolvimento — detectado no teste de fumaça (o token de desenvolvimento funcionou em produção), corrigido antes de qualquer uso real e o script passou a ler os segredos só do arquivo de produção; (3) a API não lia os cabeçalhos do proxy, o que faria todos os usuários compartilharem o mesmo limite de tentativas por IP — corrigido com teste.

#### P9 — Documentação (4 agentes)

- **Objetivo:** gerar a documentação do produto no modelo acadêmico e esta entrega parcial.
- **Contexto informado:** arquivo de convenções com estrutura, formato de troca entre agentes (Markdown com âncoras), fatos do projeto e proibições (nenhum segredo, e-mail real ou IP com usuário); agentes separados para conteúdo, diagramas, capturas de tela e montagem do Word.
- **Saída esperada:** conteúdo, 13 diagramas Mermaid, 16 capturas reais com dados fictícios e o documento montado com índice correto.
- **Problemas encontrados:** um agente, para testar a detecção de arquivo corrompido, leu por conta própria milhares de PDFs e imagens pessoais do computador (só leitura local, nada copiado ou enviado — conferido); o agente de capturas, ao perceber dados reais no banco local, criou um banco separado com dados fictícios. Os dois casos mostraram a necessidade de limites explícitos sobre o que o agente pode acessar.

<!-- ANCORA: 5.2 -->

#### O que foi feito até o momento

Em cerca de um dia de trabalho concentrado (28/09/2026, 23h36, a 29/09/2026, 14h32, seguido da documentação), o projeto saiu do áudio do cliente para um sistema publicado em produção:

| Etapa | Resultado |
|---|---|
| Insumos | Transcrição do áudio, guia de identidade visual (`design.md`) e Spec Kit configurado. |
| Especificação | Constituição, spec (US1–US7 na primeira rodada), plano, modelo de dados, contrato OpenAPI com 34 operações e 116 tarefas. |
| Implementação paralela | Portal, área Jotanunes e API implementados por três agentes em cerca de 40 minutos. |
| E2E e correções | Primeira rodada do roteiro (30 passos) executada no navegador; 3 defeitos encontrados e corrigidos com testes de regressão. |
| Convergência | 6 lacunas encontradas e fechadas (T117–T122). |
| Perfis e catálogo | Administrador × comum vindos do Fluig, 403 auditado, 10 tipos padrão (T123–T145). |
| Implantação | VPS com nginx, HTTPS, systemd e PostgreSQL; três domínios no ar; e-mails reais pelo Resend com o logo da Jotanunes. |
| Login próprio | Área Jotanunes sem depender do Fluig, tela de usuários, primeiro administrador criado em produção (T146–T176). |
| Documentação | Documento de 109 páginas no modelo acadêmico, versão só com os capítulos 1 a 4, e esta entrega. |

Estado atual: 176 tarefas concluídas; 467 testes no backend, 190 na área Jotanunes e 71 no portal, todos passando; roteiro E2E manual (56 passos) executado.

#### Como trabalhamos

O dono do produto respondeu perguntas objetivas (stack, integração com o Fluig, e-mail, autoria) e validou as decisões que o áudio deixou em aberto; o orquestrador transformou cada resposta em atualização da especificação **antes** de mexer no código. A implementação foi dividida por área, com fronteiras de pasta rígidas e o contrato OpenAPI como fonte única de verdade, o que permitiu três agentes trabalharem ao mesmo tempo sem conflito. Cada entrega passou por revisão, execução de todas as suítes de teste, teste ponta a ponta no navegador e só então commit (sem coautoria automática, por regra do usuário).

#### Impacto das ferramentas de IA

- **Velocidade:** a estimativa por Pontos de Caso de Uso deu cerca de 158 UCP (≈ 3.164 horas no método tradicional); o sistema funcional e publicado saiu em cerca de um dia de calendário.
- **Qualidade por construção:** como os agentes escrevem testes junto com o código, o projeto já nasceu com quase 730 testes automatizados, testes de contrato e testes de autorização em todas as rotas.
- **Rastreabilidade:** toda decisão está na spec (com data e situação "assumida" ou "validada"), toda tarefa tem requisito, e todo commit descreve o porquê.
- **Limite importante:** a IA não substituiu a revisão. Os defeitos mais sérios (segredos de desenvolvimento em produção, cabeçalhos do proxy, enumeração de CNPJ, convite na URL) só apareceram com teste real, análise de convergência e revisão do orquestrador.

#### O que aprendemos

1. Especificação primeiro: com o contrato pronto, os agentes paralelos não precisaram se coordenar entre si.
2. Prompt bom é prompt com fronteiras: dizer o que o agente **não** pode fazer (pastas, contrato, commits, segredos) evitou mais erros do que detalhar o que fazer.
3. Avisar armadilhas conhecidas no prompt funciona: o problema de configuração de um projeto anterior não se repetiu.
4. Teste ponta a ponta no ambiente real é insubstituível: todos os defeitos de integração passaram pelos testes unitários.
5. Agentes precisam de limites também sobre **dados**: sem regra explícita, um agente usou arquivos pessoais como massa de teste.

#### Dificuldades e ajustes para garantir a qualidade

| Dificuldade | Ajuste feito |
|---|---|
| Decisões que o cliente deixou em aberto no áudio | Registradas como "assumidas" e depois validadas uma a uma com o dono do produto. |
| Testes de integração do projeto anterior não rodavam fora da CI | Aviso explícito no prompt; teste que prova o banco usado. |
| Agente contornou um erro do contrato em vez de corrigir | Correção feita na origem e contorno removido; regra de que divergência deve ser reportada. |
| Segredos de desenvolvimento em produção | Detectado no teste de fumaça; script de publicação passou a ler só os segredos de produção e falha se faltar algum. |
| Agente leu arquivos pessoais | Verificado que nada foi copiado; convenções passaram a proibir dados reais e pessoais. |
| Sem acesso ao Fluig | Login próprio com usuários internos, mantendo o Fluig pronto para quando houver acesso. |
