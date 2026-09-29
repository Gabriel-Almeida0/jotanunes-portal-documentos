# 1. Introdução ao Documento

Este capítulo apresenta o projeto, com tema, objetivo, delimitação do problema, justificativa, método de trabalho adotado, organização do documento e glossário dos termos do domínio.

## 1.1. Tema

Portal de Documentação de Terceirizadas Jotanunes: plataforma web para solicitação, envio e análise dos documentos exigidos pela Jotanunes Construtora das empresas terceirizadas contratadas para as suas obras.

## 1.2. Objetivo do Projeto

Desenvolver uma plataforma web composta por duas interfaces e uma API comum. A primeira interface, a Área Jotanunes, é aberta de dentro do Fluig ou com login e senha próprios e permite à equipe da Jotanunes cadastrar obras, empresas terceirizadas e tipos de documento, vincular empresas às obras, convidar as empresas por e-mail e analisar (aprovar ou rejeitar com motivo) os documentos recebidos. A segunda, o Portal da Terceirizada, permite que cada empresa entre com CNPJ e senha, veja os documentos exigidos, envie os arquivos, acompanhe a análise e reenvie o que for rejeitado. A solução deve garantir o isolamento entre empresas, a rastreabilidade das decisões e a proteção dos dados pessoais e documentos tratados, em conformidade com a Lei Geral de Proteção de Dados (LGPD).

## 1.3. Delimitação do Problema

O problema está delimitado ao ciclo de documentação das empresas terceirizadas: pedir os documentos, recebê-los e analisá-los. A plataforma cobre o cadastro de obras, empresas, vínculos entre obras e empresas e tipos de documento; o convite da empresa por e-mail com senha provisória; o acesso da empresa ao portal por CNPJ e senha; o envio de arquivos PDF, JPEG ou PNG de até 10 MB; a fila de análise com aprovação ou rejeição motivada; o aviso por e-mail em caso de rejeição; o painel de acompanhamento; os perfis de administrador e usuário comum; o login próprio da área Jotanunes com gestão de usuários internos; e a trilha de auditoria.

Os documentos são exigidos por empresa, e não por obra: todos os tipos de documento ativos são exigidos de todas as empresas ativas, e um envio aprovado vale para todas as obras em que a empresa atua. Ficam fora do escopo da primeira versão: controle de validade e vencimento de documentos (por exemplo, certidões que vencem), recuperação de senha self-service, vários usuários por empresa, assinatura digital de documentos, aplicativo móvel nativo e integração com outros módulos TOTVS além da identidade do Fluig. O sistema não substitui a análise jurídica ou de segurança do trabalho: ele organiza o recebimento e registra a decisão tomada pela equipe da Jotanunes.

## 1.4. Justificativa da Escolha do Tema

Antes da plataforma, a Jotanunes pedia os documentos das empresas terceirizadas de forma manual, por e-mail e mensagens, sem um lugar único para saber o que cada empresa já enviou, o que falta, o que foi recusado e por quê. Esse controle é necessário para a contratação e a permanência das empresas nas obras, porque os documentos (certidões negativas, contrato social, programas de segurança e saúde ocupacional, responsabilidade técnica) comprovam a regularidade fiscal, trabalhista e técnica das contratadas.

Uma plataforma dedicada reduz o retrabalho, dá à empresa terceirizada clareza sobre o que precisa enviar e à Jotanunes uma visão por obra e por empresa, com histórico e responsáveis registrados. O tema foi proposto pela própria Jotanunes como desafio da Residência de Software, com requisitos levantados em reunião gravada com o cliente. O projeto também permite aplicar na prática especificação orientada a requisitos, arquitetura hexagonal, segurança e isolamento de dados, acessibilidade e testes automatizados, além da implantação real em servidor com domínio e certificado.

## 1.5. Método de Trabalho

O desenvolvimento seguiu o método de Desenvolvimento Orientado por Especificação (*Spec-Driven Development*), apoiado pela ferramenta Spec Kit[^1]. Nesse método, a especificação é o artefato central: o código é gerado e verificado a partir dela, e toda mudança de requisito começa pela atualização da especificação.

O trabalho foi organizado nas etapas do Spec Kit, executadas em sequência e repetidas a cada nova rodada de requisitos:

1. **Constituição** (*constitution*): definição dos princípios inegociáveis do projeto — arquitetura hexagonal no backend, contrato de API como fonte de verdade, segurança, isolamento e LGPD, testes obrigatórios, identidade visual Jotanunes sem frameworks de CSS e simplicidade com adaptadores trocáveis.
2. **Especificação** (*specify*): a partir da transcrição da reunião com o cliente, escrita das histórias de usuário, cenários de aceitação, requisitos funcionais (FR), entidades e critérios de sucesso mensuráveis.
3. **Esclarecimento** (*clarify*): perguntas objetivas sobre pontos ambíguos (senha do convite, documentos por empresa ou por obra, formatos aceitos, perfis). As respostas foram registradas na especificação e validadas pelo dono do produto.
4. **Plano** (*plan*): contexto técnico, pesquisa de alternativas, modelo de dados, contrato OpenAPI da API e contrato de identidade do Fluig.
5. **Tarefas** (*tasks*): quebra do plano em tarefas numeradas e ordenadas por dependência, agrupadas por história de usuário e por área (backend, área Jotanunes, portal). Ao final do projeto, o arquivo de tarefas somava 176 tarefas (T001 a T176).
6. **Análise** (*analyze*): verificação de consistência entre especificação, plano e tarefas antes da implementação.
7. **Implementação** (*implement*): execução das tarefas por agentes de IA trabalhando em paralelo, um por área — backend (.NET 8), área Jotanunes (React) e portal (React) —, coordenados por um orquestrador que integra os resultados, resolve conflitos e revisa o código.
8. **Convergência** (*converge*): comparação do código com a especificação, o plano e a constituição, com criação de tarefas novas para as lacunas encontradas (por exemplo, T117 a T122).

A implementação adotou Desenvolvimento Guiado por Testes (TDD): os testes de cada tarefa foram escritos antes ou junto do código e precisam passar para a tarefa ser dada como concluída. O backend tem testes de domínio, de aplicação e de API contra um PostgreSQL real em contêiner; as interfaces têm testes de componentes e de telas. Ao fim de cada rodada, o orquestrador executou o roteiro de teste ponta a ponta (E2E) descrito no guia de verificação do projeto, percorrendo o fluxo completo nas três aplicações integradas.

Os requisitos evoluíram em três rodadas, cada uma passando novamente pelas etapas acima: a versão inicial (cadastros, convite, envio e análise), a rodada de perfis de acesso e catálogo padrão de tipos de documento, e a rodada de login próprio da área Jotanunes com gestão de usuários internos, motivada pelo fato de a Jotanunes ainda não ter acesso ao Fluig. Todas as decisões foram registradas na especificação, com data e origem (validada pelo dono do produto ou decisão técnica derivada).

## 1.6. Organização do Trabalho

O trabalho foi desenvolvido pela Squad 81 da Residência de Software, com a Jotanunes Construtora como organização contratante. As atividades foram distribuídas por frente: levantamento e validação de requisitos com o cliente; especificação e planejamento no Spec Kit; implementação por área (API, área Jotanunes e portal), executada por agentes de IA orquestrados; revisão, integração e testes ponta a ponta; implantação no servidor de produção; e documentação.

Este documento está organizado da seguinte forma. O Capítulo 1 apresenta o projeto. O Capítulo 2 descreve o problema, os envolvidos e as regras de negócio. O Capítulo 3 reúne os requisitos funcionais e não funcionais, o protótipo das telas com o diagrama de navegação e a estimativa de esforço com o cronograma. O Capítulo 4 traz a análise e o design (arquitetura, modelos UML e modelo de dados). O Capítulo 5 descreve a implementação, o Capítulo 6 os testes, o Capítulo 7 a implantação e o Capítulo 8 o manual do usuário. O Capítulo 9 apresenta as conclusões, seguido da bibliografia.

## 1.7. Glossário

A tabela a seguir define os termos importantes utilizados no projeto.

| Termo | Definição |
|---|---|
| Administrador | Perfil da área Jotanunes que, além de consultar tudo, cadastra, edita, ativa e desativa obras, empresas e tipos de documento, vincula e desvincula empresas das obras, aprova e rejeita envios e gerencia os usuários internos. Na entrada pelo Fluig, vem do papel no token; no login próprio, vem do cadastro do usuário interno. |
| Análise | Decisão da Jotanunes sobre um envio: aprovar ou rejeitar. A rejeição exige motivo de 5 a 500 caracteres. A decisão registra quem decidiu e quando e não pode ser alterada. |
| API | Interface de programação (*Application Programming Interface*) do sistema, em .NET 8, usada pelas duas interfaces web. Suas operações estão descritas no contrato OpenAPI. |
| Área Jotanunes | Interface web usada pela equipe da Jotanunes para cadastros, convites, acompanhamento e análise. Pode ser aberta de dentro do Fluig ou com o login próprio. |
| Auditoria | Trilha de registros das ações relevantes (logins, trocas de senha, convites, envios, downloads, decisões, gestão de usuários e tentativas negadas), com quem, quando, qual recurso e origem da identidade, sem gravar senhas, tokens ou conteúdo de arquivos. |
| Bloqueio de acesso | Impedimento temporário de 15 minutos após 5 tentativas seguidas de senha errada para o mesmo CNPJ (portal) ou login (área Jotanunes), inclusive para CNPJ ou login inexistente. |
| Catálogo padrão | Conjunto de 10 tipos de documento (Cartão CNPJ, Contrato Social, CND Federal, CND Estadual, CND Municipal, CRF do FGTS, CNDT, PGR, PCMSO e ART/RRT) criado automaticamente pelo sistema numa instalação com catálogo vazio. |
| CNPJ alfanumérico | Novo formato do Cadastro Nacional da Pessoa Jurídica da Receita Federal, vigente desde julho de 2026, com letras e números nas 12 primeiras posições. O sistema aceita os formatos numérico e alfanumérico e valida os dígitos verificadores. |
| Convite | E-mail enviado à empresa terceirizada com o link do portal, a senha provisória, o nome da empresa, as obras vinculadas e as instruções de primeiro acesso. Vale 7 dias e é invalidado por um reenvio. |
| E2E | Teste ponta a ponta (*end-to-end*): verificação do fluxo completo com as três aplicações integradas (API, área Jotanunes e portal), como um usuário real faria. |
| Envio | Cada arquivo que a empresa manda para um tipo de documento. Um tipo pode ter vários envios ao longo do tempo, por exemplo o reenvio após uma rejeição. |
| Fila de análise | Lista de envios "Em análise", do mais antigo para o mais novo, com filtros por obra, empresa e tipo de documento. |
| Fluig | Plataforma corporativa (TOTVS) usada pela Jotanunes. Quando disponível, abre a área Jotanunes e entrega a identidade do usuário em um token assinado, dispensando nova tela de login. |
| LGPD | Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018), que regula o tratamento de dados pessoais no Brasil e orienta as regras de acesso, isolamento e auditoria do sistema. |
| Login próprio | Entrada na área Jotanunes com login e senha de usuário interno, sem o Fluig. Convive com a entrada pelo Fluig e pode ser desligada por configuração. |
| Obra | Empreendimento da Jotanunes onde as empresas terceirizadas prestam serviço. Tem nome, código interno opcional, cidade e UF. |
| Portal da Terceirizada | Interface web usada pela empresa terceirizada, com acesso por CNPJ e senha, para ver os documentos exigidos, enviar arquivos e acompanhar a análise. |
| Resend | Serviço externo de envio de e-mails transacionais usado pela API para convites, avisos de rejeição e senhas provisórias de usuários internos. |
| Senha provisória | Senha aleatória de 12 caracteres gerada pelo sistema e enviada por e-mail no convite da empresa ou no cadastro e na redefinição de senha de usuário interno. Vale 7 dias e precisa ser trocada no primeiro acesso. |
| Situação de acesso | Estado da empresa em relação ao portal: Não convidada, Convidada, Convite expirado, Ativa ou Desativada. |
| Situação do documento | Estado de um tipo de documento para uma empresa: Pendente de envio, Em análise, Aprovado ou Rejeitado. É derivada do envio mais recente. |
| Spec Kit | Conjunto de ferramentas e comandos para Desenvolvimento Orientado por Especificação, com as etapas constituição, especificação, esclarecimento, plano, tarefas, análise, implementação e convergência. |
| Spec-Driven Development | Desenvolvimento Orientado por Especificação: método em que a especificação escrita é a fonte de verdade e o código é produzido e verificado a partir dela. |
| TDD | Desenvolvimento Guiado por Testes (*Test-Driven Development*): prática de escrever os testes automatizados antes ou junto do código que eles verificam. |
| Terceirizada | Empresa contratada pela Jotanunes para prestar serviço em uma ou mais obras, identificada de forma única pelo CNPJ. Tem um acesso ao portal por CNPJ. |
| Tipo de Documento | Item do catálogo de documentos exigidos pela Jotanunes (por exemplo, "Cartão CNPJ" ou "PCMSO"), com nome único e instruções para a empresa. Todo tipo ativo é exigido de todas as empresas ativas. |
| Token/JWT | Credencial assinada no formato *JSON Web Token* que identifica o usuário a cada requisição. Há tokens distintos para o Fluig, para o login próprio e para o portal, e um não é aceito no lugar do outro. Vale no máximo 8 horas. |
| Usuário comum | Perfil da área Jotanunes que consulta tudo (painel, listas, detalhes, históricos, arquivos) e envia ou reenvia convites, mas não cadastra, não altera e não analisa. |
| Usuário interno | Colaborador da Jotanunes cadastrado no próprio sistema (nome, e-mail, login e perfil), que entra na área Jotanunes pelo login próprio. |
| Vínculo | Relação "esta empresa atua nesta obra". Uma obra tem várias empresas e uma empresa pode atuar em várias obras. Serve para organizar e filtrar. |
| WCAG | Diretrizes de Acessibilidade para Conteúdo Web (*Web Content Accessibility Guidelines*). O sistema adota o nível AA de contraste e exibe toda situação com texto, não só por cor. |

[^1]: Para maiores detalhes sobre o Desenvolvimento Orientado por Especificação e a ferramenta Spec Kit, consultar a documentação do projeto GitHub Spec Kit (github.com/github/spec-kit). Sobre processos de desenvolvimento de software em geral, consultar o livro Engenharia de Software – Roger Pressman – Capítulo 2.
