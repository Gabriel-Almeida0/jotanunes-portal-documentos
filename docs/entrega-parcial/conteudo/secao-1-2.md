<!-- ANCORA: 1.1 -->

#### Problema

A Jotanunes pede os documentos das terceirizadas de forma manual, por e-mail e mensagens, sem um lugar único que mostre o que cada empresa enviou, o que falta, o que foi recusado e por quê, nem quem analisou.

<!-- 208 caracteres -->

#### Solução

Plataforma web em duas partes: a área Jotanunes (via Fluig ou login próprio) cadastra obras, empresas e documentos exigidos, convida por e-mail e analisa; no portal, a terceirizada entra com CNPJ e senha e envia os arquivos.

<!-- 224 caracteres -->

#### Onde a IA gera valor

**Transparência:** a versão atual do produto (API, área Jotanunes e portal) **não usa IA em produção** — não há chamada a modelo de linguagem, OCR nem modelo preditivo. A análise dos documentos é 100% humana. A IA gerou valor no **processo de construção** e há oportunidades claras de IA no produto, apresentadas abaixo como **proposta para a próxima iteração**.

**Valor atual da IA no processo (usado de fato):**

- **Transcrição dos requisitos (automação):** o áudio da conversa com o representante da Jotanunes (4 min 16 s) foi transcrito localmente com o *faster-whisper* (modelo "medium", gratuito, sem enviar o áudio a terceiros). Nomes próprios mal reconhecidos foram corrigidos à mão ("JET News" → Jotanunes, "fluido"/"WIG" → Fluig, "esse IPJ" → CNPJ).
- **Especificação (geração de conteúdo):** com o GitHub Spec Kit e o Claude Code, a transcrição virou constituição, especificação (10 histórias, requisitos FR, critérios de sucesso SC), clarificações, plano, modelo de dados, contrato OpenAPI e 176 tarefas (T001–T176).
- **Implementação (automação):** agentes de IA trabalharam em paralelo, um por área (backend .NET, área Jotanunes em React e portal em React), cada um restrito à sua pasta; um orquestrador revisou, integrou, testou e fez os commits.
- **Testes (automação):** os agentes escreveram os testes antes do código (TDD) — 728 testes automatizados, todos aprovados — e conduziram os roteiros ponta a ponta (E2E) no navegador (Playwright), com `curl` e `psql`.
- **Qualidade dos artefatos (automação):** `speckit-analyze` (consistência entre spec, plano e tarefas) e `speckit-converge` (código × spec), que encontraram lacunas reais corrigidas antes da entrega.
- **Documentação (geração de conteúdo):** diagramas (Mermaid), documentação do produto e este relatório gerados com agentes e revisados.

**Oportunidades de IA no produto (proposta, não implementado):**

| Oportunidade | Tipo | Valor | Situação |
|---|---|---|---|
| Extrair automaticamente do arquivo enviado a data de emissão, a data de validade, o órgão emissor e o CNPJ das certidões (OCR + modelo de linguagem) | Automação | Elimina a digitação e a conferência manual de datas; base para controlar vencimento (hoje fora do escopo da v1) | Proposta |
| Alertar a Jotanunes e a empresa antes do vencimento de certidões e estimar quais empresas têm risco de ficar irregulares | Predição | Evita que a empresa atue na obra com certidão vencida | Proposta |
| Verificar se o arquivo corresponde ao tipo de documento pedido (ex.: CND Municipal enviada no lugar da Federal) e se o CNPJ do documento é o da empresa | Predição (classificação) | Recusa precoce de envios errados, menos ciclos de rejeição e reenvio | Proposta |
| Detectar documento ilegível (foto escura, cortada, desfocada) no momento do envio, ainda no portal | Predição (classificação) | A empresa corrige na hora, sem esperar a análise | Proposta |
| Pré-triagem para o analista: resumo do documento com os pontos a conferir e divergências encontradas | Geração de conteúdo | Análise mais rápida; o analista decide com mais informação | Proposta |
| Sugerir um texto claro para o motivo da rejeição, a partir do que foi detectado | Geração de conteúdo | Motivos mais objetivos, menos dúvidas da terceirizada | Proposta |

Em todas as propostas, a IA **sugere** e o administrador da Jotanunes **decide**: aprovar e rejeitar continuam sendo ações humanas, registradas com autor, data e motivo.

#### Personas

Nomes fictícios.

**Persona 1 — Mariana Couto, administradora da Jotanunes**

- **Papel:** colaboradora com perfil de administrador na área Jotanunes; responde pela documentação das terceirizadas.
- **Objetivos:** manter o cadastro de obras, empresas e tipos de documento em dia; analisar rapidamente o que chega; saber quais empresas estão irregulares antes de liberar o serviço na obra.
- **Dores:** documentos chegam por e-mail e mensagens, misturados; não sabe com certeza qual é a versão mais recente; motivos de recusa se perdem; precisa conferir datas e CNPJ de cada certidão à mão.
- **Como usa o sistema:** entra pelo login próprio (ou pelo Fluig, quando a TI configurar), cadastra obras e empresas, vincula empresas às obras, ajusta o catálogo de tipos, trabalha a fila de análise (aprova ou rejeita com motivo) e gerencia os usuários internos na tela "Usuários".
- **Como a IA a ajudará (proposta):** pré-triagem com datas, emissor e CNPJ já extraídos e divergências destacadas; sugestão do texto do motivo de rejeição; alerta de certidões perto do vencimento.

**Persona 2 — Rafael Nogueira, analista da Jotanunes (usuário comum)**

- **Papel:** colaborador que acompanha as obras e cobra as empresas, sem alterar cadastros nem decidir análises.
- **Objetivos:** saber, por obra, quais empresas têm pendência; convidar e reconvidar empresas assim que o contrato é fechado.
- **Dores:** precisa perguntar a várias pessoas o que já foi entregue; não tem uma visão por obra.
- **Como usa o sistema:** consulta o painel (envios em análise, empresas com pendência, convidadas sem primeiro acesso), o detalhe das obras e das empresas, os históricos e os arquivos; envia e reenvia convites. As ações de administrador não aparecem para ele, e a API as recusa (403 `SEM_PERMISSAO`).
- **Como a IA o ajudará (proposta):** lista priorizada das empresas com maior risco de ficar irregulares (predição de vencimento) e lembretes automáticos.

**Persona 3 — Carla Mendes, representante da empresa terceirizada**

- **Papel:** responsável administrativa de uma empresa contratada para uma ou mais obras (ex.: "Instaladora Horizonte Ltda.", fictícia); usa o celular com frequência.
- **Objetivos:** saber exatamente o que enviar, enviar rápido e entender por que algo foi recusado.
- **Dores:** listas de documentos passadas por mensagem, sem retorno claro; não sabe se o arquivo chegou nem se foi aceito; recusas sem explicação.
- **Como usa o sistema:** recebe o convite por e-mail, entra no portal com CNPJ e a senha provisória, cria a própria senha, vê os documentos exigidos com a situação em texto (Pendente de envio, Em análise, Aprovado, Rejeitado), envia PDF/JPEG/PNG de até 10 MB, lê o motivo das rejeições e reenvia.
- **Como a IA a ajudará (proposta):** aviso imediato, ainda no envio, de que a foto está ilegível ou de que o arquivo não parece ser o documento pedido; alerta antes de a certidão vencer.

**Persona 4 — Bruno Farias, TI da Jotanunes (Fluig e servidor)**

- **Papel:** integra a área Jotanunes ao Fluig (token de identidade assinado e grupo de administradores) e opera o servidor.
- **Objetivos:** controlar quem acessa o sistema a partir dos perfis do Fluig; instalar e manter o sistema com segurança.
- **Dores:** sistemas que exigem mais um cadastro de usuários; segredos espalhados; falta de trilha de auditoria.
- **Como usa o sistema:** configura a abertura pelo Fluig com o papel `admin` no token; na instalação, roda o comando `criar-admin` para criar o primeiro administrador interno; consulta a auditoria e os logs em JSON (sem senhas nem tokens).
- **Como a IA o ajudará (proposta):** sem uso direto de IA no papel dele; caberia a ele aprovar o provedor de IA (contrato, LGPD, custo) e monitorar a disponibilidade e a latência do serviço de IA, com o sistema funcionando normalmente sem ele.

**Persona 5 — Jotanunes Construtora, dona do produto (organização)**

- **Papel:** representada pela pessoa que conduziu o levantamento de requisitos e pelo dono do produto que validou as decisões.
- **Objetivos:** processo único, rastreável e alinhado à LGPD para comprovar a regularidade fiscal, trabalhista e técnica das contratadas.
- **Dores:** risco jurídico e trabalhista de manter terceirizada irregular na obra; dependência da memória de quem cuida do processo.
- **Como usa o sistema:** define quais documentos são exigidos e valida as regras de negócio registradas na especificação.
- **Como a IA a ajudará (proposta):** visão consolidada de vencimentos futuros e indicadores de tempo de análise e de taxa de rejeição por tipo de documento.

<!-- ANCORA: 1.2 -->

#### Cenários de uso principais

1. **Cadastro e convite:** a administradora cadastra a obra, a empresa (razão social, CNPJ, e-mail) e a vincula à obra; clica em "Enviar convite" e a empresa recebe o link do portal e uma senha provisória (7 dias).
2. **Primeiro acesso:** a terceirizada abre o link (CNPJ já preenchido), entra com a senha provisória e é obrigada a criar a própria senha antes de ver qualquer dado.
3. **Envio de documentos:** a terceirizada vê os documentos exigidos ("Pendente de envio") e envia um arquivo para cada; a situação passa a "Em análise".
4. **Análise:** a administradora abre a fila (mais antigos primeiro, filtros por obra, empresa e tipo), abre o arquivo e aprova, ou rejeita com motivo; na rejeição, a empresa recebe e-mail com o motivo.
5. **Reenvio:** a terceirizada vê "Rejeitado" e o motivo, envia um novo arquivo e o ciclo recomeça; o histórico guarda todos os envios.
6. **Acompanhamento:** o analista (usuário comum) consulta o painel e o detalhe da obra ("4 de 6 aprovados") e reenvia convites, sem poder alterar cadastros nem decidir.
7. **Gestão de acesso interno:** a administradora cadastra colegas na tela "Usuários", define o perfil, redefine senhas e desativa quem saiu da empresa; na instalação, a TI cria o primeiro administrador por comando.

#### Casos de borda e de falha críticos — produto

| Cenário | Risco | Comportamento do sistema hoje | Como seria com IA (proposta) |
|---|---|---|---|
| Arquivo corrompido, truncado, vazio ou com extensão trocada (ex.: `.exe` renomeado para `.pdf`) | Documento inútil ou malicioso entrar na análise | Formato conferido pelos bytes iniciais e verificação estrutural do final do arquivo: `415 ARQUIVO_TIPO_NAO_SUPORTADO` ou `400 ARQUIVO_INVALIDO` | Além da validação atual, checar legibilidade e se o conteúdo corresponde ao tipo pedido |
| Arquivo acima de 10 MB | Sobrecarga de disco e de rede | Validação no portal antes do envio e no servidor: `413 ARQUIVO_MUITO_GRANDE`, com o formato e o tamanho aceitos na mensagem | — |
| Convite expirado (mais de 7 dias sem primeiro acesso) | Senha provisória vazada ser usada tarde | Acesso recusado: "Seu convite expirou. Peça um novo convite à Jotanunes."; reenvio invalida link e senha anteriores | — |
| Link de convite adulterado, já usado ou substituído | Acesso indevido | "Este link não é mais válido."; token guardado só como hash, validado por `POST` (fora de logs e do histórico) | — |
| Senha errada repetida (força bruta) e tentativa de descobrir CNPJ ou login cadastrado | Invasão de conta; enumeração de empresas | Bloqueio de 15 min após 5 falhas, também para CNPJ ou login inexistente; mesma mensagem e mesmo tempo de resposta nos dois casos; limite de requisições por IP | Detecção de padrões anômalos de login (predição), como apoio ao bloqueio |
| Sessão expirada no meio do upload | Empresa achar que enviou e não ter enviado | API responde `401`; o portal leva ao login com "Sua sessão expirou. Entre de novo." e o arquivo precisa ser enviado de novo | — |
| Dupla análise concorrente (duas pessoas decidindo o mesmo envio) | Decisões contraditórias | Atualização condicional no banco: só a primeira vale; a segunda recebe `409 ENVIO_JA_ANALISADO` | — |
| Dois envios simultâneos para o mesmo documento (duas abas) | Dois arquivos "Em análise" | Índice parcial no banco garante um único envio vivo; o segundo recebe `409 ENVIO_NAO_PERMITIDO` | — |
| Serviço de e-mail (Resend) fora do ar no convite ou no cadastro de usuário | Empresa marcada como convidada sem ter recebido nada | Ordem grava → envia → confirma; na falha, `502 EMAIL_FALHOU` ("Não conseguimos enviar o convite. Tente de novo em alguns minutos.") e nada é gravado | — |
| Resend fora do ar na rejeição | Empresa não saber da rejeição | Decisão mantida; aviso no log; a empresa vê "Rejeitado" e o motivo no próximo acesso | — |
| Empresa desativada | Ex-contratada continuar enviando ou consultando | Acesso recusado na hora (sessão derrubada pela versão da credencial); convite recusado; ao reativar, volta com a senha que tinha | — |
| CNPJ alfanumérico (formato da Receita Federal vigente desde julho de 2026) e CNPJ com ou sem máscara | Recusar empresa válida ou duplicar cadastro | Dígitos verificadores validados nos dois formatos; armazenado sem máscara; duplicidade recusada (`409 CNPJ_DUPLICADO`) | OCR conferir o CNPJ impresso no documento com o cadastrado |
| Tentativa de desativar ou tirar o papel do último administrador interno (ou de si mesmo) | Sistema ficar sem ninguém que o administre | Recusa: "O sistema precisa de pelo menos um administrador ativo." e "Você não pode desativar nem tirar o seu próprio acesso de administrador."; corrida entre dois administradores resolvida por trava exclusiva | — |
| Token do Fluig inválido (expirado, segredo, emissor ou audiência errados, `alg=none`, validade acima de 8 h) ou claim `roles` em formato inesperado | Acesso indevido ou elevação de privilégio | `401 NAO_AUTENTICADO` e tela de login próprio (ou "Abra este sistema pelo Fluig." se o login próprio estiver desligado); `roles` ausente, vazia, em maiúsculas ou de tipo inesperado → usuário comum | — |
| Usuário comum chamando operação de administrador direto na API | Alteração sem permissão | `403 SEM_PERMISSAO` antes de validar dados ou procurar o recurso, sem nenhum efeito; tentativa registrada na auditoria | — |
| Empresa A tentando acessar documento da empresa B (alterando endereços) | Vazamento de dados (LGPD) | Empresa identificada só pelo token; resposta `404`, como se o recurso não existisse | — |

#### Casos de borda de IA — da proposta (não implementado)

Hoje nenhum destes casos ocorre, porque não há IA no produto: a análise é inteiramente humana. Eles orientam como a proposta deve ser construída.

| Cenário | Risco | Comportamento do sistema hoje | Como seria com IA (proposta) |
|---|---|---|---|
| OCR lê a data de validade errada (ex.: troca dia e mês, lê a data de emissão como validade) | Certidão vencida tratada como válida, ou alerta falso | Não se aplica: a administradora lê o documento | Extração sempre exibida como sugestão com a confiança; abaixo do limiar, campo marcado "conferir manualmente"; datas impossíveis (validade antes da emissão, no passado) recusadas por regra clássica; confirmação humana obrigatória |
| Documento ilegível (foto escura, cortada, desfocada) | Extração inventada ou vazia | Não se aplica: a administradora rejeita com motivo | Classificador de legibilidade avisa a empresa no envio; sem leitura confiável, nenhum campo é preenchido automaticamente |
| Falso positivo (IA diz que o arquivo é o documento certo e não é) | Documento errado aprovado | Não se aplica | IA nunca aprova: a decisão é sempre humana; o resultado da IA aparece como apoio, nunca como selo de aprovado |
| Falso negativo (IA diz que o arquivo está errado e está certo) | Retrabalho e atrito com a terceirizada | Não se aplica | IA não bloqueia o envio: apenas avisa; a empresa pode enviar mesmo assim e o analista decide |
| Alucinação no resumo ou no motivo de rejeição sugerido (texto com fato que não está no documento) | Rejeição injusta ou informação falsa à empresa | Não se aplica: o motivo é digitado pela administradora | Resumo restrito a campos extraídos com referência ao trecho do documento; motivo sugerido sempre editável e só enviado após confirmação humana |
| Serviço de IA indisponível, lento ou com resposta inesperada | Fila de análise travada | Não se aplica | Processamento assíncrono com tempo limite; na falha, o envio segue para a fila sem os campos sugeridos (o processo atual continua funcionando) |
| Dados pessoais enviados a um provedor externo de IA | Violação da LGPD | Não se aplica: os arquivos não saem do servidor | Provedor com contrato e cláusula de não treinamento, ou modelo local; registro na auditoria de cada processamento |

#### Casos de borda do uso de IA no processo (ocorridos e tratados)

| Cenário | Risco | O que aconteceu e como foi tratado |
|---|---|---|
| Agente gerando código que diverge do contrato OpenAPI | Front e API incompatíveis | Regra: nenhum agente edita o contrato; divergência é reportada ao orquestrador. Teste de contrato confere as 43 operações, `operationId`, enumerados, DTOs, títulos de erro e `x-requer-admin`; os tipos dos fronts são gerados do contrato. Uma descrição que tornava o YAML inválido foi detectada e corrigida, com os tipos regenerados |
| Agente marcar como pronto algo que não cumpre a spec | Requisito de segurança faltando em produção | `speckit-converge` encontrou 6 lacunas (T117–T122), entre elas o bloqueio de login que só existia para CNPJ cadastrado (revelava quais CNPJs existiam), arquivo truncado aceito e recusas de login fora da auditoria; todas corrigidas com testes |
| Segredo de desenvolvimento chegando à produção | Tokens forjáveis em produção | Na preparação da publicação, verificou-se que a configuração de produção podia herdar os segredos de assinatura do desenvolvimento; o script de publicação passou a ler os segredos só de um arquivo fora do git e a parar se faltarem, forem fracos ou repetidos; a API não sobe com segredo inseguro |
| Decisão do usuário conflitando com a constituição | Regra de segurança violada sem perceber | `speckit-analyze` apontou que o adaptador de e-mail de desenvolvimento grava o e-mail (com senha provisória) no log, o que a constituição proibia; virou exceção explícita e restrita ao desenvolvimento (constituição 1.0.1) |
| Agente sem humano para responder ao `clarify` | Suposição tratada como requisito | As respostas foram registradas como "Decisão assumida (a validar)" e depois validadas pelo dono do produto (ver 1.3) |
| Defeito que os testes unitários não pegaram (integração real) | Ação aplicada ao registro errado | No E2E e na revisão, o orquestrador encontrou que um modal de aprovação aberto no envio A podia aprovar o envio B ao navegar entre detalhes; corrigido com 10 testes de regressão |
| Agentes paralelos editando os mesmos arquivos | Conflitos e perda de trabalho | Fronteira de pastas: cada tarefa tem uma única área (`backend/`, `fluig-app/`, `portal/`, raiz) e nenhuma exige editar arquivos de outra |
| Transcrição automática errando nomes próprios | Requisito com nome errado ("JET News", "fluido", "esse IPJ") | Revisão humana da transcrição com correção manual dos nomes, registrada no topo do arquivo |

<!-- ANCORA: 1.3 -->

#### (a) Entrevista com humano

- **Data:** 28/09/2026 (áudio de WhatsApp gravado às 21h24, duração de 4 min 16 s).
- **Participantes (por papel):** representante da Jotanunes que apresentou o desafio e integrante da Squad 81 (entrevistador). A conversa retoma combinações feitas "durante essas semanas" com o cliente.
- **Registro:** áudio transcrito localmente com *faster-whisper* (modelo "medium") e revisado à mão (`docs/transcricao.txt`).

**Pontos de dor descobertos:**

- A Jotanunes precisa "acionar essas empresas para que elas anexem os documentos que são necessários, para que eles consigam analisar isso" — hoje não há plataforma para isso.
- Falta um gatilho formal para o início do processo: "já fechamos o contrato, manda os meus documentos".
- O controle de quem, dentro da Jotanunes, pode cadastrar e analisar deve seguir os perfis que a empresa já usa (Fluig).
- A terceirizada precisa de um acesso próprio, simples, só para anexar o que é exigido.

**Hipóteses validadas na conversa:**

| Hipótese | Evidência na entrevista | Resultado |
|---|---|---|
| São dois sistemas: um da Jotanunes (integrado ao Fluig) e outro da terceirizada | "pode pensar que são dois sistemas diferentes" | Validada |
| A organização é obra → empresas → documentos | "Então é obra, empresas e das empresas os documentos." — "Exatamente." | Validada |
| Os tipos de documento são os mesmos para todas as empresas | "Os mesmos tipos." | Validada |
| O convite é por e-mail com link para o sistema | "A primeira forma é enviar um e-mail [...] um linkzinho dele, clique, acessa o sistema" | Validada |
| A terceirizada entra com CNPJ e senha | "O combinado foi ser CNPJ e senha" | Validada |
| A área Jotanunes não precisa de login próprio, pois o Fluig controla o acesso | "Não precisa-se de um login. Porque o próprio Fluig já tem esse contrato de perfil" | Validada em 28/09; **revista em 29/09** (ver abaixo) |

**Decisões que ficaram para validar e como foram validadas depois:**

| Ponto em aberto | Como ficou na entrevista | Validação posterior (dono do produto) |
|---|---|---|
| Quem define a senha da empresa | "vê o Gustavo, o que ele prefere" — duas opções: Jotanunes define, ou o sistema gera e a empresa troca no primeiro acesso | **VALIDADA em 29/09/2026:** o sistema gera senha temporária, enviada no mesmo e-mail do link, com troca obrigatória no primeiro acesso |
| Documentos por empresa ou por empresa + obra | Implícito ("das empresas os documentos") | **VALIDADA em 29/09/2026:** por empresa; um envio vale para todas as obras ("tem várias empresas por obra e documentos por empresa") |
| Seleção de documentos por empresa | "Os mesmos tipos" | **VALIDADA em 29/09/2026:** todos os tipos ativos para todas as empresas ativas |
| Todos os usuários do Fluig com as mesmas permissões | Não discutido | **VALIDADA em 29/09/2026 (nova decisão):** perfis administrador e comum, com o papel vindo do Fluig |
| Acesso só pelo Fluig | "Não precisa-se de um login" | **VALIDADA em 29/09/2026 (tarde), substituindo a anterior:** a Jotanunes ainda não tem acesso ao Fluig; a área Jotanunes ganha login próprio além do Fluig, com usuários internos na tela "Usuários" e primeiro administrador criado na instalação |
| Catálogo inicial de tipos de documento | "a gente já sabe quais são os documentos" | **VALIDADA em 29/09/2026:** instalação nova já sobe com 10 tipos padrão (Cartão CNPJ, Contrato Social, CNDs Federal/Estadual/Municipal, CRF do FGTS, CNDT, PGR, PCMSO, ART/RRT) |
| Formatos e tamanho (PDF/JPEG/PNG até 10 MB), prazo do convite (7 dias), bloqueio (5 falhas/15 min), sessão de 8 h | Não discutido | Continuam como "decisões assumidas" registradas na spec, a confirmar com a Jotanunes |

#### (b) Entrevistas com agentes inteligentes

As etapas do Spec Kit funcionaram como entrevistas estruturadas em que o agente de IA questionou a especificação. As respostas ficaram registradas na seção *Clarifications* da `spec.md`, com data e origem.

**Sessão `speckit-clarify` de 28/09/2026 (sem humano disponível).** A primeira versão da spec tinha 3 marcadores `[NEEDS CLARIFICATION]`. O agente fez as 5 perguntas permitidas e, sem humano para responder, adotou a opção recomendada, marcada "Decisão assumida (a validar com Gustavo/Jotanunes)":

| Pergunta do agente | Decisão proposta | Resultado |
|---|---|---|
| Quem define a senha da empresa no portal? | Sistema gera senha temporária aleatória enviada no convite; troca obrigatória no primeiro acesso | Validada pelo dono do produto em 29/09 |
| Documentos exigidos por empresa ou por empresa + obra? | Por empresa; o vínculo com a obra serve para organizar e filtrar | Validada em 29/09 |
| Quais tipos são exigidos de cada empresa? | Todos os tipos ativos de todas as empresas ativas | Validada em 29/09 |
| Quais formatos e tamanho de arquivo? | PDF, JPEG e PNG, até 10 MB, um arquivo por envio | Mantida como decisão assumida |
| A senha temporária pode ir no mesmo e-mail do link? | Sim, mitigada por expiração em 7 dias, uso único e troca obrigatória | Validada em 29/09 |

Além das 5 perguntas, o agente listou em "Outras decisões assumidas" os pontos decididos pela opção mais razoável (prazo do convite, bloqueio, sessão de 8 h, e-mail só na rejeição, nada excluído pela interface, CNPJ imutável após o convite), para validação posterior.

**Sessões de 29/09/2026 (com o dono do produto).** O agente reabriu as decisões assumidas e levou as novas necessidades à spec: perfis administrador/comum (US6), catálogo padrão (US7) e login próprio com usuários internos (US8–US10). Para o login próprio, o agente derivou e registrou como "decisões técnicas derivadas" (research R17): senha provisória com as mesmas regras do portal, revogação imediata das sessões ao mudar papel ou desativar, regra do último administrador e chave para desligar o login próprio.

**Análises que descobriram lacunas:**

| Etapa | Achado do agente | Resultado |
|---|---|---|
| Checklist de qualidade da spec | 3 marcadores de ambiguidade (fluxo de senha, documentos por empresa × obra, formatos e tamanho) | Resolvidos no `clarify`; checklist de 15/16 para 16/16 |
| `speckit-analyze` (28/09) | Conflito entre a decisão de registrar o e-mail no log em desenvolvimento e a regra da constituição que proíbe senhas em log | Constituição 1.0.1 com exceção explícita e restrita ao adaptador de desenvolvimento |
| `speckit-converge` (29/09) | Bloqueio de 5 falhas só para empresas convidadas, permitindo descobrir se um CNPJ existe | T117: contador por HMAC para CNPJs sem cadastro e BCrypt fictício para igualar o tempo de resposta |
| `speckit-converge` (29/09) | Arquivo com cabeçalho válido mas truncado era aceito | T118: verificação estrutural do final do arquivo (`400 ARQUIVO_INVALIDO`) |
| `speckit-converge` (29/09) | Recusas de login por empresa desativada e por senha temporária vencida não entravam na auditoria | T119: registro `LOGIN_FALHA` |
| `speckit-converge` (29/09) | Histórico de tipos desativados inacessível na área Jotanunes; fluxos de tela sem testes | T120 e T121 |
| `speckit-converge` (29/09) | Logs fora de desenvolvimento não estavam em JSON estruturado | T122 |

<!-- ANCORA: 2.1 -->

#### Épicos

| Épico | Objetivo | Histórias | Prioridade |
|---|---|---|---|
| E1 — Cadastros e catálogo | Ter a quem pedir e o que pedir: obras, empresas, vínculos e tipos de documento, com catálogo padrão na instalação | US1, US7 | P1 (US1), P2 (US7) |
| E2 — Convite e acesso da terceirizada | Disparar o processo por e-mail e dar à empresa um acesso seguro por CNPJ e senha | US2 | P1 |
| E3 — Envio e análise de documentos | Receber os arquivos, analisar (aprovar/rejeitar com motivo) e permitir o reenvio | US3, US4 | P1 (US3), P2 (US4) |
| E4 — Acompanhamento | Indicadores e visão por obra e por empresa | US5 | P3 |
| E5 — Controle de acesso da área Jotanunes | Perfis, login próprio, gestão de usuários internos e primeiro administrador | US6, US8, US9, US10 | P1 |

#### Histórias de usuário

| ID | História | Prioridade | Épico |
|---|---|---|---|
| US1 | Como **administradora da Jotanunes** (Mariana), quero cadastrar tipos de documento, obras e empresas e vincular empresas às obras, para saber de quem pedir e o que pedir | P1 | E1 |
| US2 | Como **administradora ou analista da Jotanunes**, quero enviar um convite por e-mail com link e senha provisória, para que a empresa contratada comece a enviar os documentos | P1 | E2 |
| US3 | Como **representante da terceirizada** (Carla), quero ver os documentos exigidos e enviar os arquivos pelo portal, para cumprir as exigências e acompanhar a situação de cada um | P1 | E3 |
| US4 | Como **administradora da Jotanunes**, quero aprovar ou rejeitar cada envio com motivo, e a terceirizada quer ver o motivo e reenviar, para fechar o ciclo de análise com rastreabilidade | P2 | E3 |
| US5 | Como **analista da Jotanunes** (Rafael), quero um painel e a situação por obra e por empresa, para cobrar as pendências certas | P3 | E4 |
| US6 | Como **Jotanunes**, quero que só administradores cadastrem, alterem e analisem, enquanto usuários comuns consultam e convidam, para controlar quem decide | P1 | E5 |
| US7 | Como **administradora da Jotanunes**, quero que uma instalação nova já venha com os 10 tipos de documento mais comuns, para começar a usar sem digitar o catálogo | P2 | E1 |
| US8 | Como **colaborador da Jotanunes**, quero entrar na área Jotanunes com login e senha próprios, para usar o sistema enquanto o Fluig não está disponível | P1 | E5 |
| US9 | Como **administradora da Jotanunes**, quero cadastrar, editar, desativar e redefinir a senha dos usuários internos, para controlar quem tem acesso | P1 | E5 |
| US10 | Como **TI da Jotanunes** (Bruno), quero criar o primeiro administrador por um comando no servidor, para que alguém consiga entrar numa instalação nova | P1 | E5 |

#### Detalhamento das tarefas

As 176 tarefas (T001–T176) estão em `specs/001-portal-documentos-terceirizadas/tasks.md`, cada uma com exatamente uma área: `[BACKEND]` (API .NET 8), `[FLUIG]` (área Jotanunes, React), `[PORTAL]` (portal da terceirizada, React) e `[INFRA]` (raiz, scripts, deploy). Os testes de cada história vêm antes da implementação.

**Base (todas as histórias):** Setup T001–T011 (compose do PostgreSQL, `.env.example`, script de token do Fluig de desenvolvimento, solução .NET, projetos Vite) e Fundação T012–T042 — backend T012–T025 (CNPJ numérico e alfanumérico, entidades, `DbContext`, migration, erros no padrão do contrato, autenticação Fluig e Portal, validação da configuração, infraestrutura de testes com Testcontainers), área Jotanunes T026–T034 (tokens visuais, cliente gerado do contrato, leitura do token Fluig, mocks MSW, componentes base) e portal T035–T042 (idem, sessão e rotas).

| História | Backend | Área Jotanunes (FLUIG) | Portal / Infra |
|---|---|---|---|
| US1 | Testes T043–T047 (domínio, obras, empresas, vínculos e tipos, autorização em todas as rotas); implementação T048–T054 (regras, repositórios, consulta de situação, casos de uso e endpoints) | T055–T059 (mocks, telas de tipos, obras, empresas e testes) | — |
| US2 | Testes T060–T063 (convite, acesso, troca de senha); implementação T064–T069 (política de senha, BCrypt, tokens, Resend, modelo de e-mail, casos de uso, rate limiter) | T070–T072 (seção "Acesso ao portal", enviar/reenviar convite) | Portal T073–T076 (tela de acesso, troca de senha, testes) |
| US3 | Testes T077–T079 (detector de formato, documentos, isolamento entre empresas); implementação T080–T083 (armazenamento, envio, download, endpoints com limite de 11 MB) | — | Portal T084–T088 (componente de envio, "Meus documentos", histórico, testes) |
| US4 | Testes T089–T090; implementação T091–T093 (aprovar/rejeitar, fila, concorrência, e-mail de rejeição) | T094–T098 (fila de análise, tela de análise, histórico por empresa) | Portal T099–T100 (rejeitado com motivo e reenvio) |
| US5 | T101–T102 (painel e filtros) | T103–T105 (painel com indicadores e filtros) | — |
| Transversal | T106–T109 (teste de contrato, desempenho com 20.000 envios, cabeçalhos de segurança) | T110–T112 (proibição de framework CSS, acessibilidade) | Portal T113–T115; E2E T116 |
| Convergência | T117–T119, T122 (bloqueio sem enumeração, arquivo truncado, auditoria, log JSON) | T120–T121 | — |
| US6 | T123–T130 (perfil pela claim `roles`, teste que percorre todas as rotas de escrita, política `FluigAdmin`, auditoria com perfil) | T136–T143 (perfil na interface, `SomenteAdmin`, modo leitura, testes de 403) | Infra T135 (token `--admin`); Portal T144; E2E T145 |
| US7 | T131–T134 (catálogo de 10 tipos, semeador idempotente com trava exclusiva) | — | — |
| US8 | T146–T149, T153, T155–T160 (domínio do usuário interno, login, troca de senha, esquema `LoginLocal`, configuração) | T165–T169, T172 (sessão, tela de login, troca de senha, testes) | Portal T175 |
| US9 | T150–T152, T161 (revogação de sessões, gestão de usuários, regra do último administrador, e-mail de acesso) | T170–T171, T173–T174 (menu, tela "Usuários", testes) | — |
| US10 | T154, T162 (comando `criar-admin`) | — | Infra T163–T164 (documentação e deploy); E2E T176 |

#### Padrões de uso de ferramentas de IA no projeto

- **Desenvolvimento orientado por especificação (GitHub Spec Kit):** constituição → specify → clarify → plan → tasks → analyze → implement → converge, repetido a cada rodada de requisitos (versão inicial, perfis e catálogo, login próprio). Toda mudança começa pela spec; textos substituídos ficam riscados com data, sem apagar o histórico.
- **Agentes paralelos com fronteira de pastas:** um agente por área (BACKEND, FLUIG, PORTAL; nas rodadas seguintes, BACKEND+INFRA e FLUIG), cada um editando apenas a sua pasta. Os fronts trabalham contra mocks (MSW) que seguem o contrato, sem esperar o backend.
- **Orquestrador revisa, integra e faz os commits:** os agentes não fazem commit; o orquestrador revisa cada entrega, roda as suítes, integra as três áreas e registra commits por grupo lógico de tarefas.
- **TDD:** testes escritos antes, vistos falhando, e só então a implementação; tarefa só termina com a suíte verde.
- **Contrato como fonte de verdade:** `contracts/openapi.yaml` (versão 1.2.0, 43 operações) é lido por todos e editado por nenhum agente; divergência é reportada ao orquestrador.
- **Verificação cruzada por IA:** `speckit-analyze` antes de implementar e `speckit-converge` depois, com as lacunas viradas em tarefas numeradas.
- **E2E conduzido por agente:** roteiro do `quickstart.md` (56 passos) executado com as áreas integradas, no navegador (Playwright), com `curl` e `psql`, ao fim de cada rodada (T116, T145, T176).
- **Regras fixas:** nenhum segredo, senha, token ou e-mail real em código, commits ou documentos (segredos de produção só em arquivo fora do git); commits sem linha de coautoria de ferramenta; decisões assumidas pela IA marcadas como "a validar" até o dono do produto confirmar.

<!-- ANCORA: 2.2 -->

#### Critérios de aceite

| História | Critério de aceite (Dado / Quando / Então) |
|---|---|
| US1 | **Dado** a tela de empresas, **quando** a administradora cadastra uma empresa com CNPJ válido, razão social e e-mail, **então** a empresa aparece na lista com acesso "Não convidada". |
| US1 | **Dado** uma empresa com o CNPJ 12.345.678/0001-95, **quando** se tenta cadastrar outra com o mesmo CNPJ (com ou sem máscara), **então** o sistema recusa e informa que o CNPJ já está cadastrado. |
| US1 | **Dado** um CNPJ (numérico ou alfanumérico) com dígito verificador inválido, **quando** a administradora salva, **então** o sistema recusa e indica o campo CNPJ. |
| US2 | **Dado** uma empresa com e-mail de contato, **quando** se clica em "Enviar convite", **então** o e-mail sai com link, nome da empresa, obras e instruções, e a empresa passa a "Convidada". |
| US2 | **Dado** um convite válido, **quando** a empresa entra com CNPJ e a senha do convite, **então** o portal exige "Crie uma nova senha para continuar." e não mostra outra tela até a troca. |
| US2 | **Dado** um convite com mais de 7 dias sem primeiro acesso, **quando** a empresa tenta entrar, **então** vê "Seu convite expirou. Peça um novo convite à Jotanunes.". |
| US3 | **Dado** uma empresa autenticada e 3 tipos ativos, **quando** abre "Meus documentos", **então** vê os 3 com nome, instruções e situação escrita (não só cor). |
| US3 | **Dado** um arquivo em formato não aceito ou acima de 10 MB, **quando** a empresa tenta enviar, **então** o envio é recusado com mensagem dizendo o formato e o tamanho aceitos. |
| US3 | **Dado** a empresa A autenticada, **quando** tenta ver, baixar ou enviar documento da empresa B, **então** o sistema responde como se o recurso não existisse. |
| US4 | **Dado** um envio "Em análise", **quando** a administradora rejeita sem motivo, **então** o sistema recusa e pede o motivo. |
| US4 | **Dado** um envio "Em análise", **quando** rejeita com motivo, **então** a situação passa a "Rejeitado", ficam registrados usuário, data/hora e motivo, e a empresa recebe e-mail com o motivo. |
| US4 | **Dado** duas pessoas abrindo o mesmo envio, **quando** a segunda decide depois da primeira, **então** o sistema recusa informando que o envio já foi analisado. |
| US5 | **Dado** dados cadastrados, **quando** o analista abre o painel, **então** vê o total de envios em análise, de empresas com pendência e de convidadas sem primeiro acesso. |
| US5 | **Dado** uma obra com empresas vinculadas, **quando** o analista abre a obra, **então** vê cada empresa com a contagem de documentos por situação. |
| US6 | **Dado** um usuário comum, **quando** chama na API qualquer operação de administrador, **então** recebe 403 `SEM_PERMISSAO`, nada muda e a tentativa fica na auditoria. |
| US6 | **Dado** um usuário comum, **quando** abre o sistema, **então** vê painel, listas, detalhes e arquivos, sem os botões de administrador e com o aviso "Só administradores podem cadastrar, alterar ou analisar. Se você precisa, fale com a TI.". |
| US6 | **Dado** um usuário comum, **quando** envia ou reenvia o convite de uma empresa, **então** o convite é enviado normalmente. |
| US7 | **Dado** um banco sem nenhum tipo de documento, **quando** a API sobe, **então** existem os 10 tipos padrão ativos com instruções. |
| US7 | **Dado** o catálogo padrão já criado, **quando** a API reinicia (uma ou várias instâncias ao mesmo tempo), **então** nenhum tipo é duplicado. |
| US8 | **Dado** o login próprio ligado e nenhum token, **quando** a área Jotanunes carrega, **então** aparece a tela de login e nenhum dado. |
| US8 | **Dado** login inexistente ou senha errada, **quando** o usuário tenta entrar, **então** vê a mesma mensagem "Login ou senha incorretos." nos dois casos; após 5 erros, bloqueio de 15 minutos igual para os dois. |
| US8 | **Dado** uma sessão de login próprio, **quando** o usuário clica em "Sair", **então** volta ao login e aquela sessão deixa de valer na API na hora. |
| US9 | **Dado** o formulário "Novo usuário", **quando** a administradora salva nome, e-mail, login e perfil, **então** o usuário aparece como "Aguardando primeiro acesso", recebe o e-mail com a senha provisória e a senha não aparece na tela. |
| US9 | **Dado** um usuário com sessão aberta, **quando** a administradora o desativa, **então** a próxima ação dele é recusada e ele não consegue entrar de novo. |
| US9 | **Dado** um único administrador interno ativo, **quando** alguém tenta desativá-lo ou tirar o papel dele, **então** o sistema recusa com "O sistema precisa de pelo menos um administrador ativo.". |
| US10 | **Dado** nenhum administrador interno ativo, **quando** a TI roda o comando com login, nome e e-mail, **então** o administrador é criado, o e-mail sai e a senha provisória aparece só no terminal. |
| US10 | **Dado** já existir administrador interno ativo, **quando** o comando roda sem a opção de forçar, **então** nada é criado nem alterado. |
| US10 | **Dado** qualquer execução do comando, **quando** o log da aplicação é consultado, **então** a senha provisória não aparece nele. |

#### Como garantimos que o resultado das ferramentas de IA está correto

O código foi escrito por agentes de IA; a correção foi garantida por verificações independentes do agente que escreveu o código:

- **Testes automatizados (728, todos aprovados em 29/09/2026):** backend 467 (domínio 104, aplicação 42, integração da API 321 contra PostgreSQL 16 real via Testcontainers), área Jotanunes 190 e portal 71 (Vitest + Testing Library + MSW). Escritos antes do código (TDD), a partir dos cenários de aceitação da spec.
- **Teste de contrato OpenAPI:** compara a API em execução com o `openapi.yaml` — 43 operações, rotas, `operationId`, enumerados, propriedades dos DTOs, títulos de erro e a marcação `x-requer-admin`. Um agente que inventasse rota ou campo quebraria o teste.
- **Testes de autorização em todas as rotas:** um teste enumera as rotas registradas na API e exige `403 SEM_PERMISSAO` para usuário comum e sucesso para administrador, nas duas origens de identidade (Fluig e login próprio); uma rota nova sem classificação faz o teste falhar (SC-009 e SC-012). Testes de isolamento garantem que a empresa B nunca vê dados da empresa A (SC-003).
- **Revisão humana e do orquestrador:** cada entrega dos agentes foi revisada antes do commit; decisões de negócio tomadas pela IA ficaram marcadas "a validar" até a confirmação do dono do produto.
- **E2E real:** roteiro de 56 passos com API, área Jotanunes, portal e banco integrados, executado ao fim de cada rodada (T116, T145, T176), incluindo bloqueio, revogação de sessão, concorrência e tokens cruzados.
- **`speckit-analyze` e `speckit-converge`:** verificação cruzada entre spec, plano, tarefas, constituição e código; a convergência gerou 6 tarefas de correção (T117–T122).
- **Regressões encontradas e corrigidas (com testes):** enumeração de CNPJ pelo bloqueio, arquivo truncado aceito, token do convite exposto na URL (passou a `POST`), modal de aprovação aplicado ao envio errado, IP real perdido atrás do proxy, risco de segredo de desenvolvimento em produção e YAML do contrato inválido — nenhum defeito conhecido em aberto.
- **Validação visual e de acessibilidade:** telas conferidas no navegador contra o guia visual (`docs/design.md`), contraste WCAG AA, uso a partir de 360 px e script que falha se algum framework de CSS for adicionado.

**Critérios para a proposta de IA no produto (a adotar na próxima iteração):**

| Critério | Meta proposta |
|---|---|
| Precisão da extração de datas e CNPJ | Medida num conjunto de referência de documentos reais anonimizados, conferidos por pessoa; meta inicial de ao menos 95% de acerto exato por campo antes de liberar |
| Confiança mínima | Campo com confiança abaixo do limiar (ex.: 0,85) não é preenchido: aparece como "conferir manualmente" |
| Revisão humana obrigatória | A IA nunca aprova nem rejeita; toda decisão continua humana, com autor, data e motivo |
| Regras clássicas sobre a saída da IA | Datas impossíveis, CNPJ com dígito verificador inválido ou diferente do cadastrado são sinalizados sem depender do modelo |
| Falso positivo e falso negativo | Monitorados pela concordância entre a sugestão da IA e a decisão do analista; queda abaixo da meta desliga a sugestão |
| Rastreabilidade | Versão do modelo, confiança e resultado de cada processamento registrados na auditoria |
| Resiliência | Tempo limite e processamento assíncrono; com a IA fora do ar, o fluxo atual segue sem perda |
| LGPD | Provedor com contrato e sem uso dos dados para treinamento, ou modelo local; nada de documento em log |
| Testes | Conjunto de referência rodado como teste de regressão a cada mudança de modelo ou de prompt |
