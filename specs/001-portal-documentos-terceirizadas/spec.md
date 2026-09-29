# Feature Specification: Portal de Documentação de Terceirizadas Jotanunes

**Feature Branch**: `001-portal-documentos-terceirizadas`

**Created**: 2026-09-28

**Status**: Draft (implementado até T145; atualizações de 2026-09-29: perfis de acesso e catálogo
padrão de tipos de documento — US6, US7, FR-080–FR-093; **login próprio da área Jotanunes e usuários
internos — US8, US9, US10, FR-100–FR-116**)

**Input**: User description: "A Jotanunes (construtora) precisa acionar as empresas terceirizadas contratadas para que enviem documentos, e analisar esses documentos. Dois sistemas: (1) lado Jotanunes, aberto de dentro do Fluig, sem login próprio, para cadastrar obras, empresas (com e-mail de contato), vincular empresas às obras, cadastrar tipos de documento (os mesmos para todas as empresas), disparar e-mail de convite com link para o portal e analisar os documentos (aprovar/rejeitar com motivo); (2) portal da empresa terceirizada, com login por CNPJ + senha, onde a empresa vê os documentos exigidos, anexa arquivos, acompanha o status e reenvia os rejeitados." (fonte: `docs/transcricao.txt`)

## Visão geral

Hoje a Jotanunes pede os documentos das empresas terceirizadas de forma manual. A plataforma
organiza esse ciclo em duas partes:

- **Área Jotanunes** (aberta de dentro do Fluig **ou**, desde 2026-09-29, com login e senha
  próprios): a equipe cadastra obras, empresas e tipos de documento, vincula empresas às obras,
  convida a empresa por e-mail e analisa o que chega.
- **Portal da terceirizada**: a empresa entra com CNPJ e senha, vê o que falta, envia os arquivos e
  acompanha a análise.

### Atores

| Ator | Quem é | Como acessa |
|---|---|---|
| **Analista Jotanunes** (usuário comum) | Colaborador da Jotanunes com acesso ao sistema | Pelo Fluig (que identifica o usuário e controla quem abre o sistema) **ou** pelo login próprio da área Jotanunes, como usuário interno cadastrado (desde 2026-09-29). Consulta tudo e envia/reenvia convites |
| **Administrador Jotanunes** | Analista com o papel de administrador | Pelo Fluig (papel no token de identidade) ou pelo login próprio (papel marcado no cadastro do usuário interno). Além do que o usuário comum faz, cadastra/edita/ativa/desativa obras, vínculos, empresas e tipos de documento, analisa (aprova/rejeita) os documentos e gerencia os usuários internos (tela "Usuários") |
| **Responsável pela instalação** | Quem instala o sistema no servidor (TI/orquestrador) | Linha de comando do servidor: cria o primeiro administrador interno (US10) |
| **Empresa terceirizada** | Empresa contratada para uma ou mais obras (um acesso por CNPJ) | Portal próprio, com CNPJ + senha |

### Glossário

- **Obra**: empreendimento da Jotanunes onde empresas terceirizadas prestam serviço.
- **Empresa**: empresa terceirizada, identificada de forma única pelo CNPJ.
- **Vínculo**: relação "esta empresa atua nesta obra".
- **Tipo de documento**: item do catálogo gerenciado pela Jotanunes (ex.: "Cartão CNPJ",
  "Certidão Negativa de Débitos Federais", "PCMSO").
- **Envio**: cada arquivo que a empresa manda para um tipo de documento. Um tipo pode ter vários
  envios ao longo do tempo (ex.: reenvio após rejeição).
- **Situação do documento**: estado de um tipo de documento para uma empresa: *Pendente de envio*,
  *Em análise*, *Aprovado* ou *Rejeitado*.
- **Convite**: e-mail enviado à empresa com o link do portal e as instruções de primeiro acesso.
- **Perfil**: papel do usuário Jotanunes na área Jotanunes: *administrador* ou *comum*. Na entrada
  pelo Fluig, vem do Fluig (claim `roles` do token de identidade, ver `contracts/fluig-identity.md`);
  na entrada pelo login próprio, vem do cadastro do usuário interno. Sem o papel, o usuário é comum.
- **Usuário interno**: colaborador da Jotanunes cadastrado no próprio sistema (nome, e-mail, login,
  se é administrador), que entra na área Jotanunes com login e senha (desde 2026-09-29).
- **Login próprio**: entrada na área Jotanunes com login + senha de usuário interno, sem o Fluig.
  Convive com a entrada pelo Fluig; pode ser desligado por configuração.
- **Senha provisória**: senha de 12 caracteres gerada pelo sistema e enviada por e-mail ao usuário
  interno no cadastro e em cada redefinição; vale 7 dias e precisa ser trocada no primeiro acesso.
- **Primeiro administrador**: usuário interno administrador criado na instalação por um comando do
  servidor (US10), para que alguém consiga entrar e cadastrar os demais.
- **Ação de administrador**: cadastrar, editar, ativar ou desativar obras (incluindo vincular e
  desvincular empresas), empresas e tipos de documento, e aprovar ou rejeitar envios.
- **Catálogo padrão**: os 10 tipos de documento que o sistema cria sozinho numa instalação nova
  (catálogo vazio). Lista em `data-model.md` §4.1.

## Clarifications

### Session 2026-09-28

> Sem humano disponível para responder durante o `/speckit-clarify`. Cada resposta abaixo é a opção
> recomendada, marcada como **Decisão assumida (a validar com Gustavo/Jotanunes)**.

- Q: Quem define a senha da empresa no portal? → A: A Jotanunes (o sistema) gera uma senha
  temporária aleatória enviada no convite; a empresa é obrigada a trocá-la no primeiro acesso.
  ~~Decisão assumida (a validar com Gustavo/Jotanunes)~~ → **VALIDADA pelo usuário (dono do
  produto) em 2026-09-29** — ver Session 2026-09-29.
- Q: Os documentos são exigidos por empresa ou por empresa + obra? → A: Por empresa. Um envio
  aprovado vale para todas as obras em que a empresa atua; o vínculo com a obra serve para a
  Jotanunes organizar e filtrar. ~~Decisão assumida (a validar com Gustavo/Jotanunes)~~ →
  **VALIDADA pelo usuário (dono do produto) em 2026-09-29** — "tem várias empresas por obra e
  documentos por empresa".
- Q: Quais tipos de documento são exigidos de cada empresa? → A: Todos os tipos de documento ativos
  do catálogo são exigidos de todas as empresas ativas; não há seleção por empresa na v1.
  ~~Decisão assumida (a validar com Gustavo/Jotanunes)~~ → **VALIDADA pelo usuário (dono do
  produto) em 2026-09-29** — resposta do áudio: "os mesmos tipos".
- Q: Quais formatos e qual tamanho de arquivo são aceitos? → A: PDF, JPEG e PNG, até 10 MB, um
  arquivo por envio. **Decisão assumida (a validar com Gustavo/Jotanunes)** — PDF cobre a maioria
  dos documentos; imagens cobrem fotos de documentos tirados no celular.
- Q: A senha temporária pode ir no mesmo e-mail do link do convite? → A: Sim, no mesmo e-mail (há um
  único contato por empresa), mitigado por expiração em 7 dias, uso único e troca obrigatória no
  primeiro acesso; a senha temporária nunca é exibida na área Jotanunes. **VALIDADA pelo usuário
  (dono do produto) em 2026-09-29** quanto à senha ir no mesmo e-mail do link; o prazo de 7 dias
  continua em "Outras decisões assumidas".

### Session 2026-09-29

> Respostas dadas pelo usuário (dono do produto). São fonte de verdade e não devem ser reabertas.

- Q: A senha provisória do convite está confirmada? → A: Sim. No convite, o sistema gera uma senha
  temporária, enviada no mesmo e-mail do link; a troca é obrigatória no primeiro acesso.
  **VALIDADA** (fecha a 1ª e a 5ª perguntas da sessão anterior).
- Q: Os documentos são exigidos de todas as empresas ou há seleção por empresa? → A: De todas as
  empresas, sem seleção por empresa. **VALIDADA** (fecha a 3ª pergunta da sessão anterior).
- Q: Todos os usuários que o Fluig deixa entrar têm as mesmas permissões? → A: Não. Há um perfil
  **administrador**, e quem é administrador vem do **Fluig** (papel no token de identidade; sem o
  papel = usuário comum). Só o administrador cadastra/edita/ativa/desativa tipos de documento, obras
  (incluindo vincular/desvincular empresas, por ser edição da obra) e empresas, e analisa
  (aprova/rejeita) documentos. O usuário comum consulta tudo (painel, listas, detalhes, histórico,
  abrir/baixar arquivos) e pode enviar/reenviar convites. **VALIDADA** — substitui a suposição
  antiga "todos têm as mesmas permissões".
- Q: O que acontece se o papel de administrador for retirado (ou dado) no meio da sessão? → A: Vale
  o papel do token atual até ele expirar (máx. 8 h); para valer na hora, a pessoa reabre o sistema
  pelo Fluig. **Decisão técnica derivada** (a API não consulta o Fluig a cada requisição).
- Q: A instalação nova já vem com tipos de documento? → A: Sim. Com o catálogo **vazio**, o sistema
  cria sozinho 10 tipos padrão (Cartão CNPJ, Contrato Social e última alteração, CND Federal, CND
  Estadual, CND Municipal, CRF do FGTS, CNDT, PGR, PCMSO, ART/RRT), com instruções curtas em
  português. Se já existir qualquer tipo (ativo ou inativo), não cria nada. O administrador ajusta
  depois pela tela. **VALIDADA**.
- Q: Os documentos são por empresa ou por empresa + obra? → A: Uma obra tem várias empresas e os
  documentos são **por empresa** (um envio vale para todas as obras da empresa). **VALIDADA** (fecha
  a 2ª pergunta da sessão anterior).

### Session 2026-09-29 (tarde) — login próprio da área Jotanunes

> Respostas dadas pelo usuário (dono do produto). São fonte de verdade e não devem ser reabertas.
> Motivo: a Jotanunes ainda **não** tem acesso ao Fluig.

- Q: Abrir a área Jotanunes pelo Fluig continua obrigatório? → A: **Não.** A área Jotanunes ganha
  **login próprio (login + senha) além do Fluig**; os dois convivem. Sem token do Fluig, aparece a
  tela de login (não mais o bloqueio "Abra este sistema pelo Fluig."). A entrada pelo Fluig continua
  funcionando quando existir. **VALIDADA** — substitui "sem login próprio" (FR-001 antigo, US1-AC1/AC2).
- Q: Onde ficam os usuários do login próprio e quem os gerencia? → A: **No banco do sistema**, com a
  tela **"Usuários"** na área Jotanunes, **só para administradores**: listar, cadastrar (nome, e-mail,
  login, se é administrador), editar, ativar/desativar e redefinir senha. **VALIDADA** — substitui
  "Não há tela no sistema para gerenciar administradores" (Assumptions).
- Q: Como nasce o primeiro administrador? → A: É criado **na instalação** (bootstrap), pelo
  responsável pelo servidor. **VALIDADA**.
- Decisões técnicas derivadas (desenho em `research.md` R17; não mudam o que foi validado):
  senha provisória gerada pelo sistema e enviada por e-mail, com troca obrigatória no primeiro acesso
  e as mesmas regras de senha, bloqueio e anti-enumeração do portal; o papel de administrador do
  usuário interno vem do cadastro e vale **na hora** (mudar o papel, desativar, redefinir ou trocar a
  senha e sair derrubam as sessões do usuário — diferente do Fluig, em que o papel vale até o token
  expirar); nunca fica sem administrador interno ativo e ninguém desativa nem tira o próprio papel;
  o login próprio pode ser desligado por configuração (aí só o Fluig abre o sistema).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cadastros da Jotanunes: tipos de documento, obras, empresas e vínculos (Priority: P1)

A analista Jotanunes abre o sistema pelo Fluig, sem nova tela de login (ou, desde 2026-09-29, entra
com o login próprio — US8). Ela cadastra os tipos de
documento que a Jotanunes exige, cadastra as obras, cadastra as empresas terceirizadas (razão
social, CNPJ e e-mail de contato) e indica quais empresas atuam em cada obra.

**Why this priority**: sem esse cadastro não existe a quem pedir documentos nem o que pedir. É a
base de todas as outras histórias.

**Perfil (desde 2026-09-29)**: os cadastros desta história (criar, editar, ativar/desativar,
vincular/desvincular) são ações de **administrador** (US6). "A analista" nos cenários abaixo, quando
cadastra ou altera algo, é uma administradora; consultar vale para os dois perfis.

**Independent Test**: abrindo o sistema com uma identidade Fluig válida **de administrador**, é
possível cadastrar 2 tipos de documento, 1 obra, 2 empresas, vincular as duas à obra e ver a lista
"Empresas da obra" com as duas.

**Acceptance Scenarios**:

1. **Given** um usuário identificado pelo Fluig, **When** ele abre o sistema, **Then** vê a tela
   inicial com o nome dele, sem pedido de login.
2. ~~**Given** alguém tentando abrir o sistema sem identidade Fluig válida (ausente, expirada ou
   adulterada), **When** a tela carrega, **Then** nenhum dado é exibido e aparece a mensagem
   "Abra este sistema pelo Fluig.".~~ (substituído em 2026-09-29, ver US8-AC1) **Given** alguém
   abrindo o sistema sem identidade válida (ausente, expirada ou adulterada), **When** a tela carrega,
   **Then** nenhum dado é exibido e aparece a tela de login próprio (US8); com o login próprio
   desligado por configuração, aparece a mensagem "Abra este sistema pelo Fluig.".
3. **Given** a tela de empresas, **When** a analista cadastra uma empresa com CNPJ válido, razão
   social e e-mail, **Then** a empresa aparece na lista com acesso "Não convidada".
4. **Given** uma empresa já cadastrada com o CNPJ 12.345.678/0001-95, **When** a analista tenta
   cadastrar outra com o mesmo CNPJ (com ou sem máscara), **Then** o sistema recusa e informa que o
   CNPJ já está cadastrado.
5. **Given** um CNPJ (numérico ou no novo formato alfanumérico da Receita Federal) com dígito
   verificador inválido, **When** a analista salva, **Then** o sistema
   recusa e indica o campo CNPJ.
6. **Given** uma obra e uma empresa cadastradas, **When** a analista vincula a empresa à obra,
   **Then** a empresa aparece em "Empresas da obra" e a obra aparece no detalhe da empresa; vincular
   de novo não duplica.
7. **Given** um tipo de documento ativo, **When** a analista o desativa, **Then** ele deixa de ser
   exigido das empresas, mas os envios já feitos continuam no histórico.

---

### User Story 2 - Convite por e-mail e primeiro acesso da empresa (Priority: P1)

No cadastro da empresa, a analista clica em "Enviar convite". A empresa recebe um e-mail com o link
do portal e as instruções de primeiro acesso, entra com o CNPJ e a senha recebida e é obrigada a
criar uma nova senha antes de continuar.

**Why this priority**: é o gatilho do processo ("fechamos o contrato, mande seus documentos") e a
porta de entrada da empresa no portal.

**Independent Test**: com uma empresa cadastrada, enviar o convite, pegar o conteúdo do e-mail
(registro de e-mails em ambiente de teste), acessar o link, entrar com CNPJ + senha do convite, trocar
a senha e entrar de novo com a senha nova.

**Acceptance Scenarios**:

1. **Given** uma empresa com e-mail de contato, **When** a analista clica em "Enviar convite",
   **Then** um e-mail é enviado para o contato com o link do portal, o nome da empresa, as obras
   vinculadas e as instruções de acesso; a empresa passa a "Convidada" e a data do envio aparece no
   cadastro.
2. **Given** um convite enviado, **When** a empresa abre o link, **Then** vê a tela de acesso do
   portal com o CNPJ já preenchido.
3. **Given** um convite válido, **When** a empresa entra com CNPJ + senha do convite, **Then** o
   portal exige a criação de uma nova senha ("Crie uma nova senha para continuar.") e não mostra
   nenhuma outra tela até a troca.
4. **Given** a senha trocada, **When** a empresa entra de novo, **Then** só a senha nova funciona; a
   do convite é recusada.
5. **Given** um convite com mais de 7 dias sem primeiro acesso, **When** a empresa tenta entrar com
   a senha do convite, **Then** o acesso é recusado com a mensagem "Seu convite expirou. Peça um
   novo convite à Jotanunes.".
6. **Given** uma empresa já convidada (ou já ativa), **When** a analista clica em "Reenviar
   convite" e confirma, **Then** um novo e-mail é enviado, a senha e o link anteriores deixam de
   valer e a empresa volta a precisar trocar a senha no próximo acesso.
7. **Given** 5 tentativas de acesso com senha errada seguidas para o mesmo CNPJ, **When** a empresa
   tenta a 6ª, **Then** o acesso fica bloqueado por 15 minutos com mensagem explicando o bloqueio.
8. **Given** uma empresa desativada pela Jotanunes, **When** tenta entrar, **Then** o acesso é
   recusado.

---

### User Story 3 - Empresa envia documentos e acompanha a situação (Priority: P1)

A empresa entra no portal e vê a lista de documentos exigidos pela Jotanunes, com a situação de
cada um. Ela anexa o arquivo de cada documento pendente e acompanha a análise.

**Why this priority**: é o objetivo do sistema do ponto de vista da empresa; junto com as histórias
1 e 2 forma o MVP.

**Independent Test**: com uma empresa ativa e 3 tipos de documento ativos, entrar no portal, ver 3
documentos "Pendente de envio", enviar um PDF para um deles e ver a situação mudar para "Em
análise".

**Acceptance Scenarios**:

1. **Given** uma empresa autenticada e 3 tipos de documento ativos, **When** ela abre "Meus
   documentos", **Then** vê os 3, cada um com nome, instruções e situação escrita (não só cor).
2. **Given** um documento "Pendente de envio", **When** a empresa anexa um arquivo aceito, **Then**
   a situação passa a "Em análise" e o envio aparece com nome do arquivo e data/hora.
3. **Given** um arquivo em formato não aceito ou acima do limite de tamanho, **When** a empresa
   tenta enviar, **Then** o envio é recusado com mensagem dizendo o formato e o tamanho aceitos.
4. **Given** um documento "Em análise" ou "Aprovado", **When** a empresa tenta enviar outro arquivo
   para ele, **Then** a opção não está disponível e o sistema recusa se a tentativa for forçada.
5. **Given** a empresa A autenticada, **When** ela tenta ver, baixar ou enviar documento da empresa
   B (por qualquer caminho, inclusive alterando endereços), **Then** o sistema responde como se o
   recurso não existisse e nenhum dado da empresa B é exposto.
6. **Given** uma empresa sem documentos pendentes, **When** abre "Meus documentos", **Then** vê a
   mensagem "Nenhum documento pendente. Tudo certo por aqui.".
7. **Given** um envio feito pela própria empresa, **When** ela clica no nome do arquivo, **Then**
   consegue baixá-lo.

---

### User Story 4 - Análise dos documentos e reenvio dos rejeitados (Priority: P2)

A analista Jotanunes vê a fila de documentos "Em análise", abre o arquivo, aprova ou rejeita
informando o motivo. A empresa vê o resultado, lê o motivo da rejeição e envia um novo arquivo.

**Why this priority**: fecha o ciclo e entrega a análise pedida pelo cliente; depende de haver
envios (histórias 1–3).

**Perfil (desde 2026-09-29)**: aprovar e rejeitar são ações de **administrador** (US6); a fila,
o detalhe, o arquivo e o histórico ficam visíveis também para o usuário comum.

**Independent Test**: com um envio "Em análise", a analista (administradora) rejeita com motivo; a empresa vê
"Rejeitado" + motivo, reenvia; a analista aprova; o histórico mostra os dois envios com quem
analisou, quando e o motivo.

**Acceptance Scenarios**:

1. **Given** envios "Em análise", **When** a analista abre a fila de análise, **Then** vê os envios
   mais antigos primeiro, com empresa, tipo de documento, data de envio e filtros por obra, empresa e
   tipo.
2. **Given** um envio "Em análise", **When** a analista abre o arquivo, **Then** ele é exibido ou
   baixado somente para usuários com identidade Fluig válida.
3. **Given** um envio "Em análise", **When** a analista aprova, **Then** a situação passa a
   "Aprovado" e ficam registrados o usuário Fluig que aprovou e a data/hora.
4. **Given** um envio "Em análise", **When** a analista rejeita sem motivo, **Then** o sistema
   recusa e pede o motivo.
5. **Given** um envio "Em análise", **When** a analista rejeita com motivo, **Then** a situação passa
   a "Rejeitado", ficam registrados usuário, data/hora e motivo, e a empresa recebe um e-mail avisando
   da rejeição com o motivo.
6. **Given** um documento "Rejeitado", **When** a empresa abre o portal, **Then** vê "Rejeitado", o
   motivo e a opção "Enviar novo arquivo"; ao reenviar, volta a "Em análise".
7. **Given** duas analistas abrindo o mesmo envio, **When** a segunda tenta decidir depois da
   primeira, **Then** o sistema recusa informando que o envio já foi analisado.
8. **Given** um tipo de documento com vários envios, **When** a analista ou a empresa abre o
   histórico, **Then** vê todos os envios em ordem do mais recente para o mais antigo, com situação,
   data da análise e motivo; só a analista vê também quem analisou (a empresa não vê dados de
   colaboradores da Jotanunes).

---

### User Story 5 - Acompanhamento por obra e por empresa (Priority: P3)

A analista vê um painel com indicadores ("documentos em análise", "empresas com pendência") e,
em cada obra, as empresas vinculadas com o progresso de documentos (ex.: "4 de 6 aprovados").

**Why this priority**: ajuda a gestão diária, mas o processo funciona sem ele.

**Independent Test**: com dados de exemplo, o painel e o detalhe da obra mostram contagens iguais
às calculadas manualmente.

**Acceptance Scenarios**:

1. **Given** dados cadastrados, **When** a analista abre o painel, **Then** vê o total de envios em
   análise, de empresas com algum documento pendente ou rejeitado e de empresas convidadas que ainda
   não fizeram o primeiro acesso.
2. **Given** uma obra com empresas vinculadas, **When** a analista abre a obra, **Then** vê cada
   empresa com contagem de documentos por situação.
3. **Given** a lista de empresas, **When** a analista filtra por obra, situação de acesso ou busca
   por nome/CNPJ, **Then** a lista mostra apenas as empresas correspondentes.

---

### User Story 6 - Perfis: administrador e usuário comum (Priority: P1)

A Jotanunes quer que só algumas pessoas mudem cadastros e decidam a análise. A TI coloca essas
pessoas no grupo de administradores do Fluig; o Fluig informa o papel no token de identidade. O
administrador faz tudo; o usuário comum acompanha tudo e convida empresas, mas não cadastra, não
altera e não aprova/rejeita.

**Why this priority**: é controle de acesso (segurança) sobre funções que já existem; sem ele,
qualquer pessoa com acesso ao sistema altera o catálogo e decide análises.

**Login próprio (desde 2026-09-29)**: os mesmos dois perfis valem para os usuários internos (US8/US9),
com o papel vindo do cadastro; as permissões e o 403 `SEM_PERMISSAO` são idênticos. Diferença: para o
usuário interno, dar ou tirar o papel vale na hora (a sessão cai, FR-106), em vez de esperar o token
expirar (AC7 abaixo vale para a entrada pelo Fluig).

**Independent Test**: com um token Fluig de usuário comum, abrir todas as telas e ver os dados, sem
nenhum botão de cadastrar, editar, ativar/desativar, vincular/desvincular, aprovar ou rejeitar;
chamar cada uma dessas operações direto na API e receber 403 `SEM_PERMISSAO`; enviar um convite com
sucesso. Com um token de administrador, fazer as mesmas operações com sucesso.

**Acceptance Scenarios**:

1. **Given** um token Fluig com o papel de administrador, **When** o usuário abre o sistema,
   **Then** vê todas as telas com as ações de cadastro, edição, ativação/desativação, vínculo e
   análise.
2. **Given** um token Fluig sem o papel de administrador (claim ausente, vazia ou sem `admin`),
   **When** o usuário abre o sistema, **Then** vê painel, listas, detalhes, históricos e arquivos,
   e **não** vê os botões de ação de administrador; onde eles ficariam aparece o aviso "Só
   administradores podem cadastrar, alterar ou analisar. Se você precisa, fale com a TI.".
3. **Given** um usuário comum, **When** ele chama direto na API qualquer operação de administrador
   (criar/editar obra, vincular/desvincular empresa, criar/editar empresa, criar/editar tipo,
   aprovar/rejeitar envio), **Then** recebe 403 com o código `SEM_PERMISSAO` e a mensagem "Só
   administradores podem fazer isso. Se você precisa, fale com a TI.", e nenhum dado de negócio
   muda (nenhum cadastro, vínculo, e-mail ou decisão); só a tentativa fica na auditoria (FR-085).
4. **Given** um usuário comum, **When** ele envia ou reenvia o convite de uma empresa, **Then** o
   convite é enviado normalmente (US2).
5. **Given** um usuário comum, **When** ele abre o detalhe de uma obra, empresa ou envio (inclusive
   por endereço digitado), **Then** vê os dados em modo leitura, sem formulário editável, e consegue
   abrir/baixar arquivos.
6. **Given** uma tela aberta com ações de administrador (ex.: estado antigo da tela), **When** a API
   responde 403 `SEM_PERMISSAO`, **Then** a tela mostra a mensagem do erro, não sai do sistema e não
   perde os dados exibidos.
7. **Given** uma administradora cujo papel foi retirado no Fluig durante a sessão, **When** ela
   continua usando o token atual, **Then** ele segue valendo como administrador até expirar (máx. 8
   h); ao reabrir o sistema pelo Fluig, passa a ser usuária comum.
8. **Given** uma ação de convite, download ou decisão, **When** ela é registrada na auditoria,
   **Then** o registro indica se o usuário Fluig era administrador; tentativas negadas por falta de
   permissão também são registradas.

---

### User Story 7 - Catálogo padrão de tipos de documento (Priority: P2)

Numa instalação nova, a Jotanunes não precisa digitar os documentos mais comuns: o sistema já sobe
com 10 tipos padrão, com instruções curtas para a empresa. O administrador ajusta nome, instruções
e ativação pela tela depois.

**Why this priority**: acelera a implantação e padroniza o que se pede, mas o processo funciona
cadastrando os tipos à mão (US1).

**Independent Test**: com um banco limpo (sem tipos), subir a API e ver, na tela de tipos de
documento, os 10 tipos padrão ativos com instruções; reiniciar a API e continuar com exatamente 10.
Com um banco que já tem 1 tipo (ativo ou inativo), subir a API e continuar com 1.

**Acceptance Scenarios**:

1. **Given** um banco novo, sem nenhum tipo de documento, **When** a API sobe, **Then** existem 10
   tipos ativos: Cartão CNPJ; Contrato Social e última alteração; CND Federal (Receita Federal/PGFN);
   CND Estadual; CND Municipal; CRF do FGTS; CNDT (Certidão Negativa de Débitos Trabalhistas); PGR
   (Programa de Gerenciamento de Riscos); PCMSO (Programa de Controle Médico de Saúde Ocupacional);
   ART/RRT — cada um com instruções curtas em português (texto em `data-model.md` §4.1).
2. **Given** o catálogo padrão já criado, **When** a API reinicia (uma ou várias instâncias ao mesmo
   tempo), **Then** nenhum tipo é duplicado.
3. **Given** um banco com qualquer tipo cadastrado (ativo ou inativo, criado à mão ou pelo padrão),
   **When** a API sobe, **Then** nada é criado.
4. **Given** o catálogo padrão criado, **When** o administrador edita, desativa ou cria tipos,
   **Then** as mudanças valem como em qualquer tipo (US1) e não são desfeitas em reinícios.
5. **Given** empresas ativas numa instalação nova, **When** o catálogo padrão é criado, **Then** os
   10 tipos aparecem como "Pendente de envio" para elas (FR-015).

### User Story 8 - Entrar na área Jotanunes com login e senha próprios (Priority: P1)

A Jotanunes ainda não tem o Fluig. A colaboradora recebe por e-mail o login e uma senha provisória,
abre o endereço da área Jotanunes, entra com login e senha, cria a própria senha e usa o sistema
normalmente, com o perfil (administradora ou comum) do cadastro. Quando terminar, clica em "Sair".
Quem entra pelo Fluig continua entrando como antes, sem ver a tela de login.

**Why this priority**: sem isso a Jotanunes não consegue usar a área Jotanunes hoje; é a porta de
entrada enquanto o Fluig não estiver disponível.

**Independent Test**: com um usuário interno cadastrado (US9 ou US10), abrir a área Jotanunes sem
token, entrar com o login e a senha provisória do e-mail, trocar a senha, ver o painel com o nome,
sair e confirmar que a sessão antiga não vale mais; depois abrir com um token Fluig e entrar direto,
sem tela de login e sem "Sair".

**Acceptance Scenarios**:

1. **Given** o login próprio ligado e nenhum token (nem do Fluig, nem de sessão anterior), **When** a
   área Jotanunes carrega, **Then** aparece a tela de login ("Login" e "Senha", botão "Acessar"),
   com o logo da Jotanunes no painel de acesso, e nenhum dado.
2. **Given** um usuário interno ativo com senha provisória válida, **When** ele entra com login e
   senha provisória, **Then** a tela "Crie uma nova senha para continuar." aparece e nenhuma outra
   tela nem dado é acessível até a troca (inclusive digitando endereços).
3. **Given** a troca feita com uma senha que segue a regra (≥ 8, letra e número, diferente da
   atual), **When** ele confirma, **Then** entra no painel com o nome dele e o menu do perfil do
   cadastro; a senha provisória deixa de funcionar.
4. **Given** login inexistente ou senha errada, **When** ele tenta entrar, **Then** vê a mesma
   mensagem "Login ou senha incorretos." nos dois casos.
5. **Given** 5 tentativas erradas seguidas para o mesmo login (existente ou não), **When** ele tenta a
   6ª, **Then** o acesso fica bloqueado por 15 minutos com a mensagem de bloqueio e o horário de
   liberação, igual para login existente e inexistente.
6. **Given** um usuário interno desativado, **When** ele entra com a senha certa, **Then** o acesso é
   recusado com "Este usuário está desativado. Fale com um administrador do sistema.".
7. **Given** uma senha provisória com mais de 7 dias sem primeiro acesso, **When** ele tenta entrar
   com ela, **Then** o acesso é recusado com "Sua senha provisória expirou. Peça a um administrador
   para gerar outra.".
8. **Given** uma sessão de login próprio, **When** ele clica em "Sair", **Then** volta para a tela de
   login e aquela sessão deixa de valer na API na hora.
9. **Given** uma sessão aberta pelo Fluig, **When** o menu aparece, **Then** não há "Sair" nem
   "Trocar senha" (quem controla a sessão é o Fluig) e tudo funciona como antes (US1–US6).
10. **Given** o login próprio desligado por configuração, **When** alguém abre a área Jotanunes sem
    token, **Then** vê "Abra este sistema pelo Fluig." e a API recusa qualquer tentativa de login.
11. **Given** uma sessão de login próprio, **When** o usuário quer mudar a senha por vontade própria,
    **Then** usa "Trocar senha" no menu, informando a senha atual e a nova.

---

### User Story 9 - Administrador gerencia os usuários internos (Priority: P1)

O administrador abre "Usuários", vê quem tem acesso pelo login próprio, cadastra um colega (nome,
e-mail, login e se é administrador) — o colega recebe o e-mail com a senha provisória —, corrige
dados, dá ou tira o papel de administrador, desativa quem saiu da empresa e redefine a senha de quem
esqueceu. O usuário comum não vê a tela e a API o recusa.

**Why this priority**: sem a gestão, só o primeiro administrador entraria; e desativar quem sai da
empresa é controle de acesso (segurança, LGPD).

**Independent Test**: como administrador, cadastrar um usuário comum, pegar a senha provisória no
e-mail (registro de e-mails em teste), entrar com ele e confirmar que não vê "Usuários" e recebe
`SEM_PERMISSAO` ao chamar a API de usuários; desativar esse usuário e ver a sessão dele cair na
próxima ação; redefinir a senha e receber novo e-mail.

**Acceptance Scenarios**:

1. **Given** um administrador (pelo login próprio ou pelo Fluig), **When** abre "Usuários", **Then**
   vê a lista com nome, login, e-mail, perfil (Administrador/Comum), situação em texto (Aguardando
   primeiro acesso, Senha provisória expirada, Ativo, Desativado) e último acesso, com busca por
   nome/login/e-mail e filtros por situação ativa/desativada e perfil.
2. **Given** o formulário "Novo usuário", **When** o administrador informa nome, e-mail, login e o
   perfil e salva, **Then** o usuário aparece como "Aguardando primeiro acesso", um e-mail é enviado
   ao usuário com o login, a senha provisória, o endereço da área Jotanunes e o prazo de 7 dias, e a
   senha provisória **não** aparece na tela.
3. **Given** um login já usado (sem diferenciar maiúsculas), **When** o administrador tenta
   cadastrar outro igual, **Then** o sistema recusa com "Já existe um usuário com este login.".
4. **Given** falha no serviço de e-mail ao cadastrar ou redefinir, **When** o administrador salva,
   **Then** vê "Não conseguimos enviar o e-mail com a senha provisória. Tente de novo em alguns
   minutos." e nada é criado nem alterado.
5. **Given** um usuário interno, **When** o administrador edita nome e e-mail, **Then** os dados
   mudam; o login não pode ser alterado.
6. **Given** um usuário comum com sessão aberta, **When** o administrador o torna administrador (ou
   tira o papel de um administrador), **Then** a sessão atual desse usuário deixa de valer na próxima
   ação e, ao entrar de novo, ele tem o novo perfil.
7. **Given** um usuário com sessão aberta, **When** o administrador o desativa, **Then** a próxima
   ação desse usuário é recusada e ele volta para a tela de login; ele não consegue entrar de novo.
8. **Given** um usuário ativo, **When** o administrador clica em "Redefinir senha" e confirma,
   **Then** o usuário recebe por e-mail uma nova senha provisória (7 dias, troca obrigatória), a
   senha anterior e as sessões abertas deixam de valer, e o bloqueio por tentativas é zerado.
9. **Given** o administrador na própria linha da lista, **When** tenta se desativar ou tirar o próprio
   papel de administrador, **Then** a opção não aparece e a API recusa com "Você não pode desativar
   nem tirar o seu próprio acesso de administrador. Peça a outro administrador.".
10. **Given** um único administrador interno ativo, **When** alguém (por exemplo, um administrador
    que entrou pelo Fluig) tenta desativá-lo ou tirar o papel dele, **Then** o sistema recusa com "O
    sistema precisa de pelo menos um administrador ativo.".
11. **Given** um usuário comum (pelo login próprio ou pelo Fluig), **When** abre o menu, **Then** não
    vê "Usuários"; abrindo o endereço da tela, vê só o aviso de que é restrita a administradores; e
    chamando a API de usuários recebe 403 `SEM_PERMISSAO`, sem nenhum dado.
12. **Given** as ações desta história, **When** acontecem, **Then** ficam na auditoria (quem, quando,
    qual usuário, o que mudou em termos de ação), sem senha.

---

### User Story 10 - Primeiro administrador criado na instalação (Priority: P1)

Numa instalação nova não existe nenhum usuário interno. O responsável pelo servidor roda um comando
com o login, o nome e o e-mail do primeiro administrador; o sistema cria o usuário com senha
provisória, envia o e-mail de acesso e mostra a senha provisória só no terminal de quem rodou o
comando (para o caso de o e-mail não chegar).

**Why this priority**: sem um primeiro administrador, ninguém entra pelo login próprio para
cadastrar os outros.

**Independent Test**: com banco sem usuários internos, rodar o comando; conferir o e-mail recebido e a
senha no terminal; entrar com ela na área Jotanunes e trocar a senha; rodar o comando de novo e ver a
recusa sem alterar nada; conferir que a senha não aparece no log da aplicação.

**Acceptance Scenarios**:

1. **Given** nenhum administrador interno ativo, **When** o responsável roda o comando com login,
   nome e e-mail, **Then** o usuário é criado como administrador, "Aguardando primeiro acesso", o
   e-mail de acesso é enviado e a senha provisória aparece só no terminal.
2. **Given** já existe um administrador interno ativo, **When** o comando roda sem a opção de forçar,
   **Then** nada é criado nem alterado e o terminal explica que já existe administrador.
3. **Given** a opção de forçar (recuperação: todos os administradores esqueceram a senha ou saíram),
   **When** o comando roda com um login existente, **Then** esse usuário vira administrador ativo com
   nova senha provisória e as sessões anteriores dele deixam de valer; com login novo, é criado.
4. **Given** o e-mail falhar durante o comando, **When** ele termina, **Then** o usuário continua
   criado, a senha provisória está no terminal e há um aviso de que o e-mail não saiu.
5. **Given** qualquer execução do comando, **When** o log da aplicação é consultado, **Then** a senha
   provisória não aparece nele; a criação fica na auditoria como feita pelo sistema.
6. **Given** o login próprio desligado por configuração, **When** o comando roda, **Then** recusa e
   explica que o login próprio está desligado.

### Edge Cases

- CNPJ digitado com ou sem máscara é tratado como o mesmo CNPJ; CNPJ com dígitos verificadores
  inválidos é recusado.
- E-mail de contato inválido impede salvar; tentar convidar uma empresa desativada é recusado.
- Falha no serviço de e-mail ao convidar: a analista vê "Não conseguimos enviar o convite. Tente de
  novo em alguns minutos." e a empresa não muda de situação de acesso.
- Link de convite adulterado, já usado ou substituído por um reenvio: o portal mostra a tela de
  acesso sem CNPJ preenchido e a mensagem "Este link não é mais válido.".
- Arquivo vazio (0 bytes), com extensão trocada (ex.: `.exe` renomeado para `.pdf`) ou corrompido:
  recusado.
- Tipo de documento desativado depois de um envio: o envio some da lista de exigidos da empresa,
  continua no histórico e a analista ainda pode concluir a análise se estiver "Em análise".
- Tipo de documento criado depois que as empresas já estão ativas: passa a aparecer como
  "Pendente de envio" para todas as empresas ativas.
- Empresa desvinculada de todas as obras: continua podendo acessar o portal e enviar documentos
  (o vínculo é informativo para a Jotanunes).
- Token de sessão da empresa expirado no meio de um envio: o portal pede novo acesso e informa que o
  arquivo precisa ser enviado de novo.
- Credencial do portal usada na área Jotanunes (ou identidade Fluig usada no portal): recusada.
- Duas abas da empresa enviando para o mesmo documento ao mesmo tempo: só o primeiro envio é
  aceito; o segundo recebe a mensagem de que o documento já está em análise.
- Token Fluig sem a claim `roles`, com `roles` vazia, com valor em maiúsculas (`"Admin"`) ou de tipo
  inesperado (booleano, número): o usuário é **comum**; o token continua válido (não é 401).
- Papel de administrador retirado ou dado no meio da sessão: vale o token atual até expirar (máx.
  8 h); reabrir o sistema pelo Fluig aplica o novo papel.
- Usuário comum chamando operação de administrador com dados inválidos ou recurso inexistente:
  recebe 403 `SEM_PERMISSAO` (a permissão é verificada antes da validação e da busca do recurso).
- Usuário comum abrindo por endereço uma tela de edição: vê a tela em modo leitura.
- Sem nenhum administrador configurado no Fluig: quem entra pelo Fluig só consulta e convida até a
  TI configurar o grupo (ver `contracts/fluig-identity.md`); administradores internos do login
  próprio (US9/US10) continuam podendo fazer tudo.
- Catálogo padrão com várias instâncias da API subindo juntas: no máximo uma cria os tipos; as
  outras não duplicam nem falham ao subir.
- Catálogo padrão num banco com tipos só inativos: não cria nada (o catálogo não está vazio).
- Login próprio: login digitado com maiúsculas ou espaços nas pontas é tratado como o mesmo login
  (sem diferenciar maiúsculas; espaços removidos).
- Token do login próprio usado no portal (ou token do portal na área Jotanunes): recusado, como hoje
  entre Fluig e portal.
- Aba com sessão de login próprio aberta e, na mesma aba, a entrada pelo Fluig com token no endereço:
  vale o token do Fluig (o mais recente) e a sessão passa a ser do Fluig (sem "Sair").
- Sessão de login próprio com troca de senha pendente chamando qualquer rota de dados: recusada com
  "Crie uma nova senha para continuar."; só os dados do próprio usuário, a troca e "Sair" respondem.
- Usuário interno com o mesmo login de um usuário do Fluig: as colunas de autoria guardam o login;
  recomenda-se cadastrar o usuário interno com o mesmo login que ele terá no Fluig. A auditoria
  distingue a origem (Fluig ou login próprio).
- Administrador que entrou pelo Fluig gerencia usuários internos normalmente; a regra "não desativar
  a si mesmo" vale para a sessão de login próprio (o usuário do Fluig não é um usuário interno).
- Dois administradores desativando um ao outro ao mesmo tempo, sendo os dois únicos: no máximo um
  consegue; o outro recebe "O sistema precisa de pelo menos um administrador ativo.".
- Login próprio desligado depois de haver sessões abertas: as sessões de login próprio deixam de valer
  na hora; os usuários internos continuam cadastrados e a tela "Usuários" continua acessível para
  administradores que entrem pelo Fluig.
- Nome ou e-mail do usuário alterados com sessão aberta: a sessão continua; o nome novo aparece no
  próximo login.
- Senha provisória nunca aparece na área Jotanunes nem no log; só no e-mail e, no comando de
  instalação, no terminal.

## Requirements *(mandatory)*

### Functional Requirements

**Acesso e identidade**

- **FR-001**: ~~A área Jotanunes DEVE ser acessível somente com uma identidade de usuário emitida pelo
  Fluig (login, nome, e-mail e, opcionalmente, o papel de administrador), sem tela de login própria;
  o controle de quem pode abrir o sistema e de quem é administrador é do Fluig (FR-080).~~
  (substituído em 2026-09-29) A área Jotanunes DEVE ser acessível com uma identidade emitida pelo
  Fluig (login, nome, e-mail e, opcionalmente, o papel de administrador — FR-080) **ou** com o login
  próprio de um usuário interno (FR-100–FR-116); na entrada pelo Fluig, quem abre o sistema e quem é
  administrador continua decidido pelo Fluig.
- **FR-002**: O sistema DEVE recusar pedidos da área Jotanunes com identidade ausente, expirada,
  adulterada, revogada ou emitida para o portal.
- **FR-003**: O portal DEVE autenticar a empresa por CNPJ + senha e recusar credenciais da área
  Jotanunes.
- **FR-004**: O sistema DEVE gerar uma senha temporária aleatória (12 caracteres) a cada convite,
  enviá-la no e-mail do convite e exigir que a empresa crie uma nova senha no primeiro acesso; até a
  troca, a empresa não acessa nenhuma outra função do portal. A senha temporária nunca é exibida na
  área Jotanunes e expira junto com o convite (7 dias).
- **FR-005**: O sistema DEVE armazenar senhas apenas de forma irreversível (hash com sal) e nunca
  exibi-las nem registrá-las em logs.
- **FR-006**: O sistema DEVE bloquear o acesso por 15 minutos após 5 tentativas seguidas de senha
  errada para o mesmo CNPJ.
- **FR-007**: A senha criada pela empresa DEVE ter no mínimo 8 caracteres, com pelo menos uma letra e
  um número, e ser diferente da senha do convite.
- **FR-008**: A sessão da empresa DEVE expirar após 8 horas; a identidade Fluig vale pelo tempo
  definido pelo Fluig (máximo 8 horas); a sessão do login próprio da área Jotanunes expira em 8 horas.

**Cadastros (área Jotanunes)**

- **FR-010**: O administrador DEVE poder cadastrar, editar e ativar/desativar obras (nome,
  código interno opcional, cidade, UF); qualquer usuário Jotanunes DEVE poder listá-las e vê-las.
- **FR-011**: O administrador DEVE poder cadastrar, editar e ativar/desativar empresas (razão
  social, nome fantasia opcional, CNPJ, e-mail de contato, nome do contato e telefone opcionais);
  qualquer usuário Jotanunes DEVE poder listá-las e vê-las.
- **FR-012**: O CNPJ DEVE ser único, validado pelos dígitos verificadores (aceitando o formato
  numérico e o alfanumérico da Receita Federal, vigente desde julho de 2026) e armazenado sem máscara;
  o CNPJ não pode ser alterado depois do primeiro convite.
- **FR-013**: O administrador DEVE poder vincular e desvincular empresas de obras (é edição da
  obra); uma empresa pode estar em várias obras e uma obra pode ter várias empresas.
- **FR-014**: O administrador DEVE poder cadastrar, editar e ativar/desativar tipos de documento
  (nome único, instruções para a empresa); qualquer usuário Jotanunes DEVE poder listá-los.
- **FR-015**: Os documentos DEVEM ser exigidos **por empresa**: todos os tipos de documento ativos
  são exigidos de todas as empresas ativas, e um envio vale para todas as obras da empresa. Criar um
  tipo novo o torna "Pendente de envio" para todas as empresas ativas.
- **FR-016**: Nada é apagado definitivamente pela interface: obras, empresas e tipos de documento são
  desativados; vínculos podem ser removidos.

**Convite**

- **FR-020**: A analista DEVE poder enviar o convite a partir do cadastro da empresa; o e-mail DEVE
  conter o nome da empresa, as obras vinculadas, o link do portal e as instruções de acesso, com o
  tom de voz da Jotanunes.
- **FR-021**: O link do convite DEVE ser único, imprevisível, expirar em 7 dias e deixar de valer
  quando for usado no primeiro acesso ou substituído por um reenvio.
- **FR-022**: A analista DEVE poder reenviar o convite a qualquer momento; o reenvio invalida o
  convite anterior e redefine o acesso da empresa.
- **FR-023**: O sistema DEVE registrar cada convite (quem enviou, quando, para qual e-mail, quando
  expira, quando foi usado) e mostrar a situação de acesso da empresa: Não convidada, Convidada,
  Convite expirado, Ativa ou Desativada.

**Documentos e envios (portal)**

- **FR-030**: O portal DEVE listar para a empresa todos os documentos exigidos com a situação de
  cada um (Pendente de envio, Em análise, Aprovado, Rejeitado + motivo).
- **FR-031**: A empresa DEVE poder enviar um arquivo para documento "Pendente de envio" ou
  "Rejeitado"; o envio passa o documento a "Em análise".
- **FR-032**: O sistema DEVE aceitar somente arquivos PDF, JPEG ou PNG, com no máximo 10 MB e um
  arquivo por envio.
- **FR-033**: O sistema DEVE validar o formato pelo conteúdo real do arquivo, não apenas pela
  extensão.
- **FR-034**: A empresa DEVE poder ver o histórico de envios de cada documento e baixar os próprios
  arquivos.
- **FR-035**: Uma empresa NUNCA DEVE conseguir listar, ver, baixar ou enviar documentos de outra
  empresa; tentativas DEVEM ser respondidas como "não encontrado".

**Análise (área Jotanunes)**

- **FR-040**: A analista DEVE ter uma fila de envios "Em análise", do mais antigo para o mais novo,
  com filtros por obra, empresa e tipo de documento.
- **FR-041**: A analista DEVE poder abrir/baixar o arquivo de qualquer envio.
- **FR-042**: O administrador DEVE poder aprovar ou rejeitar um envio "Em análise"; rejeitar exige
  motivo de 5 a 500 caracteres. Usuário comum vê a fila e os envios, mas não decide (FR-081).
- **FR-043**: Cada decisão DEVE registrar o usuário Fluig (login e nome), a data/hora e o motivo
  (quando rejeição); decisões são definitivas e não podem ser editadas.
- **FR-044**: Um envio já analisado NÃO DEVE poder ser analisado de novo; a segunda decisão
  simultânea é recusada.
- **FR-045**: Ao rejeitar, o sistema DEVE enviar um e-mail à empresa informando o documento e o
  motivo, com o link do portal.
- **FR-046**: A analista DEVE ver, por empresa, a situação de cada documento e o histórico completo
  de envios.

**Acompanhamento**

- **FR-050**: A área Jotanunes DEVE mostrar indicadores: envios em análise, empresas com documento
  pendente ou rejeitado, e empresas convidadas sem primeiro acesso.
- **FR-051**: O detalhe da obra DEVE mostrar as empresas vinculadas com contagem de documentos por
  situação.

**Privacidade e segurança (LGPD)**

- **FR-060**: Os arquivos enviados DEVEM ser acessíveis somente por usuários autenticados e
  autorizados; não pode existir endereço público ou permanente para um arquivo.
- **FR-061**: O sistema DEVE registrar em trilha de auditoria: login da empresa (sucesso/falha),
  troca de senha, envio de convite, envio de documento, download de arquivo, decisão de análise e
  tentativa negada por falta de permissão (FR-085), com quem, quando, qual recurso e, para usuário
  Fluig, se era administrador — sem gravar senhas, tokens ou conteúdo de arquivos.
- **FR-062**: As mensagens de erro de login NÃO DEVEM revelar se o CNPJ existe.

**Perfis e permissões (área Jotanunes)**

- **FR-080**: O sistema DEVE reconhecer dois perfis na área Jotanunes: **administrador**, quando o
  token Fluig traz a claim `roles` contendo `admin` (regras em `contracts/fluig-identity.md`), e
  **comum** em qualquer outro caso (claim ausente, vazia, sem `admin` ou de tipo inesperado), sem
  recusar o token por causa da claim.
- **FR-081**: Somente o administrador DEVE poder: cadastrar/editar/ativar/desativar tipos de
  documento; cadastrar/editar/ativar/desativar obras, incluindo vincular e desvincular empresas;
  cadastrar/editar/ativar/desativar empresas; aprovar e rejeitar envios.
- **FR-082**: Os dois perfis DEVEM poder consultar tudo na área Jotanunes (painel, listas, detalhes,
  situação e histórico de documentos, histórico de convites, abrir/baixar arquivos) e enviar/reenviar
  convites.
- **FR-083**: A API DEVE recusar operação de administrador feita por usuário comum com 403 e o
  código `SEM_PERMISSAO` (formato `problem+json` do contrato), antes de validar dados ou procurar o
  recurso, sem nenhum efeito de negócio (cadastro, vínculo, e-mail, decisão) — o único registro
  gravado é a tentativa na auditoria (FR-085). A verificação é do servidor; esconder na
  interface não basta.
- **FR-084**: A área Jotanunes DEVE esconder as ações de administrador do usuário comum (não apenas
  desabilitar), mostrando em cada tela afetada um aviso único em texto explicando que só
  administradores cadastram, alteram ou analisam; formulários de edição viram exibição em modo
  leitura. Se a API responder `SEM_PERMISSAO`, a tela DEVE mostrar a mensagem do erro sem perder os
  dados nem sair do sistema.
- **FR-085**: A auditoria DEVE indicar, em cada registro feito por usuário Fluig, se ele era
  administrador, e DEVE registrar a tentativa negada (`PERMISSAO_NEGADA`) com usuário, operação e
  data/hora.
- **FR-086**: O perfil DEVE ser lido do token da requisição atual e valer enquanto o token for
  válido (máx. 8 h, FR-008); a API DEVE informar o perfil ao front (`GET /api/fluig/me` → `admin`).
  Para o login próprio, o token deixa de ser válido quando o papel muda (FR-106).

**Catálogo padrão de tipos de documento**

- **FR-090**: Quando o catálogo de tipos de documento estiver **vazio** (nenhum tipo, ativo ou
  inativo), o sistema DEVE criar automaticamente, ao iniciar, os 10 tipos padrão listados em
  `data-model.md` §4.1, ativos e com instruções curtas em português no tom de `docs/design.md` §9.
- **FR-091**: Se existir qualquer tipo cadastrado, o sistema NÃO DEVE criar, alterar nem reativar
  nenhum tipo ao iniciar; várias inicializações (inclusive simultâneas) NÃO DEVEM duplicar tipos.
- **FR-092**: Os tipos padrão DEVEM ser tipos comuns do catálogo: o administrador os edita,
  desativa e complementa pela tela (FR-014), e as mudanças não são desfeitas por reinícios.
- **FR-093**: A criação do catálogo padrão DEVE ficar registrada como feita pelo sistema (autor
  `sistema`), sem depender de usuário Fluig.

**Login próprio e usuários internos (área Jotanunes, desde 2026-09-29)**

- **FR-100**: A área Jotanunes DEVE oferecer duas entradas que convivem: pelo Fluig (inalterada,
  FR-001, FR-080) e pelo login próprio (login + senha de usuário interno). O login próprio DEVE vir
  ligado por padrão e poder ser desligado por configuração; desligado, a tela de login não aparece
  (sem token: "Abra este sistema pelo Fluig."), a API recusa login, troca de senha e sessões de login
  próprio, e a entrada pelo Fluig segue igual.
- **FR-101**: Sem identidade válida e com o login próprio ligado, a área Jotanunes DEVE mostrar a tela
  de login (campos "Login" e "Senha", botão "Acessar", logo no painel de acesso), sem nenhum dado.
- **FR-102**: O sistema DEVE gerar uma senha provisória aleatória de 12 caracteres ao cadastrar um
  usuário interno e a cada redefinição de senha, enviá-la por e-mail ao usuário (com o login, o
  endereço da área Jotanunes e o prazo), e exigir a troca no primeiro acesso; até a troca, o usuário
  não acessa nenhuma outra função. A senha provisória vale 7 dias, nunca é exibida na área Jotanunes
  e nunca vai para logs.
- **FR-103**: A senha criada pelo usuário interno DEVE seguir a mesma regra da empresa (FR-007: 8 a
  128 caracteres, ao menos uma letra e um número, diferente da atual) e ser guardada só de forma
  irreversível (FR-005).
- **FR-104**: O sistema DEVE bloquear por 15 minutos o login após 5 tentativas seguidas de senha
  errada para o mesmo login, **inclusive login inexistente**, e responder login inexistente e senha
  errada com a mesma mensagem e a mesma sequência de respostas (não revelar se o login existe); a
  rota de login DEVE ter o mesmo limite de requisições por IP do portal.
- **FR-105**: A sessão do login próprio DEVE durar no máximo 8 horas. O usuário DEVE poder sair
  ("Sair") e trocar a senha por vontade própria ("Trocar senha"); essas opções só aparecem em sessão
  de login próprio (a sessão do Fluig é controlada pelo Fluig).
- **FR-106**: As sessões de um usuário interno DEVEM deixar de valer na hora (na próxima requisição)
  quando ele é desativado, tem a senha redefinida ou trocada, tem o papel de administrador dado ou
  retirado, ou clica em "Sair". Mudar só nome ou e-mail não derruba sessões.
- **FR-107**: O perfil do usuário interno (administrador ou comum) DEVE vir do cadastro e seguir
  exatamente as mesmas permissões da entrada pelo Fluig (FR-081–FR-085), inclusive o 403
  `SEM_PERMISSAO` antes de qualquer efeito.
- **FR-108**: Somente administradores (de qualquer origem) DEVEM poder listar, ver, cadastrar,
  editar, ativar/desativar e redefinir a senha de usuários internos, na tela "Usuários", que só
  aparece no menu para administradores. Cadastro: nome (3–150), e-mail válido, login e se é
  administrador. Nada é apagado: usuários são desativados (FR-016).
- **FR-109**: O login do usuário interno DEVE ser único sem diferenciar maiúsculas, ter de 3 a 100
  caracteres (letras sem acento, números, ponto, hífen e sublinhado) e não pode ser alterado depois
  do cadastro.
- **FR-110**: O sistema DEVE manter sempre pelo menos um usuário interno administrador ativo: recusar
  desativar ou tirar o papel do último administrador interno ativo; e ninguém pode desativar a si
  mesmo nem tirar o próprio papel de administrador (vale para a sessão de login próprio).
- **FR-111**: A instalação DEVE ter um comando no servidor que cria o primeiro administrador interno
  (login, nome, e-mail): recusa sem alterar nada se já houver administrador interno ativo, salvo com
  a opção de forçar (recuperação), que cria o usuário ou transforma o login existente em
  administrador ativo com nova senha provisória. O comando envia o e-mail de acesso e mostra a senha
  provisória só no terminal de quem o executa; nunca a grava em log.
- **FR-112**: Se o e-mail com a senha provisória falhar no cadastro ou na redefinição pela tela, nada
  DEVE ser criado nem alterado e o administrador vê a mensagem de falha; no comando de instalação, o
  usuário é mantido e o terminal avisa que o e-mail não saiu.
- **FR-113**: A auditoria DEVE registrar, para o login próprio: login com sucesso, falha e bloqueio,
  troca de senha, saída; e, para a gestão de usuários: criação, edição, desativação, reativação e
  redefinição de senha — com quem fez, quando, qual usuário, a origem da identidade (Fluig, login
  próprio ou sistema) e se era administrador, sem senhas nem tokens.
- **FR-114**: A API DEVE informar à área Jotanunes, sem autenticação, se o login próprio está ligado,
  e, para o usuário atual, a origem da sessão (Fluig ou login próprio) e se há troca de senha
  pendente.
- **FR-115**: O token do login próprio NÃO DEVE valer no portal, e nenhum token do portal ou do Fluig
  adulterado DEVE ser aceito como login próprio (extensão de FR-002/FR-003).
- **FR-116**: Sem senha esquecida self-service também na área Jotanunes: quem esquece a senha pede a
  um administrador a redefinição (FR-102).

**Interface**

- **FR-070**: As duas interfaces DEVEM seguir o guia visual `docs/design.md` (cores, tipografia
  Montserrat, forma-assinatura, tom de voz) e atingir contraste WCAG AA.
- **FR-071**: A área Jotanunes NÃO DEVE ter cabeçalho de marca próprio (é exibida dentro do Fluig);
  a tela de login próprio (antes da sessão) pode ter o logo no painel de acesso; o portal DEVE ter
  cabeçalho com logo, nome da empresa logada e "Sair".
- **FR-072**: Toda situação DEVE ser exibida com texto, nunca só por cor.
- **FR-073**: As duas interfaces DEVEM funcionar em telas a partir de 360 px de largura (o portal
  pode ser usado no celular).

### Key Entities *(include if feature involves data)*

- **Obra**: nome, código interno (opcional), cidade, UF, ativa/inativa. Tem várias empresas via
  vínculo.
- **Empresa**: razão social, nome fantasia, CNPJ (único), e-mail e nome do contato, telefone,
  ativa/inativa, dados de acesso (senha protegida, se precisa trocar a senha, tentativas falhas,
  bloqueio, último acesso).
- **Vínculo obra–empresa**: obra, empresa, quem vinculou e quando. Único por par.
- **Tipo de documento**: nome (único), instruções, ativo/inativo. Catálogo único da Jotanunes;
  numa instalação nova começa com o catálogo padrão (10 tipos).
- **Convite**: empresa, e-mail de destino, quem enviou, quando, expiração, quando foi usado ou
  substituído.
- **Envio de documento**: empresa, tipo de documento, arquivo (nome original, formato, tamanho),
  data/hora do envio, situação (Em análise, Aprovado, Rejeitado), analista, data/hora e motivo da
  decisão.
- **Situação do documento** (derivada): para cada empresa × tipo ativo, a situação do envio mais
  recente, ou "Pendente de envio" se não houver envio.
- **Registro de auditoria**: ação, ator (usuário Fluig, usuário interno pelo login próprio, empresa,
  anônimo ou sistema), se o usuário da área Jotanunes era administrador, recurso, data/hora, IP.
- **Perfil do usuário Fluig** (não persistido): administrador ou comum, lido do token a cada
  requisição. ~~não há tabela de usuários nem de papéis no sistema.~~ (substituído em 2026-09-29:
  usuários do Fluig continuam sem cadastro no sistema; os usuários internos, abaixo, têm cadastro.)
- **Usuário interno** (desde 2026-09-29): nome, e-mail, login (único, imutável), se é administrador,
  ativo/inativo, dados de acesso (senha protegida, se precisa trocar a senha, validade da senha
  provisória, versão da credencial para derrubar sessões, tentativas falhas, bloqueio, último
  acesso), quem cadastrou e quando.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Uma analista cadastra uma empresa, vincula a uma obra e envia o convite em menos de 3
  minutos.
- **SC-002**: Uma empresa, a partir do e-mail de convite, faz o primeiro acesso, troca a senha e
  envia o primeiro documento em menos de 5 minutos.
- **SC-003**: 100% dos testes de isolamento (empresa A tentando acessar dados da empresa B, e
  credencial de um lado usada no outro) são recusados.
- **SC-004**: A empresa vê a mudança de situação (Em análise → Aprovado/Rejeitado) no próximo
  carregamento da tela após a decisão, sem ação da Jotanunes além de decidir.
- **SC-005**: 100% das decisões de análise têm analista, data/hora e (se rejeição) motivo
  registrados e visíveis no histórico.
- **SC-006**: As listas (empresas, fila de análise, documentos) abrem em até 2 segundos com 500
  empresas, 50 obras, 30 tipos de documento e 20.000 envios.
- **SC-007**: Todas as combinações de texto/fundo das telas atingem contraste WCAG AA.
- **SC-008**: Nenhum arquivo enviado pode ser obtido sem autenticação (verificado por teste).
- **SC-009**: 100% das operações de administrador respondem 403 `SEM_PERMISSAO` para usuário comum
  e têm sucesso para administrador, verificado por teste automático que percorre todas as rotas de
  escrita da área Jotanunes (uma rota de escrita nova sem classificação faz o teste falhar).
- **SC-010**: Numa instalação nova, a tela de tipos de documento mostra os 10 tipos padrão sem
  nenhum cadastro manual; após 3 reinícios seguidos, continuam exatamente 10.
- **SC-011**: Um colaborador cadastrado por um administrador recebe o e-mail, entra, troca a senha e
  chega ao painel em menos de 3 minutos.
- **SC-012**: 100% das operações de administrador (incluindo as de usuários internos) respondem
  `SEM_PERMISSAO` para usuário comum e têm sucesso para administrador, nas duas origens de identidade
  (Fluig e login próprio), verificado por teste automático que percorre todas as rotas da área
  Jotanunes.
- **SC-013**: Em 100% dos casos testados (desativar, redefinir senha, trocar senha, mudar o papel,
  sair), a próxima requisição com a sessão anterior do usuário interno é recusada.
- **SC-014**: Para um login inexistente e para um login existente com senha errada, as mensagens e a
  sequência de respostas (5 recusas e depois bloqueio) são idênticas, verificado por teste.
- **SC-015**: Numa instalação nova, o primeiro administrador entra na área Jotanunes em menos de 5
  minutos depois de o responsável rodar o comando de instalação.
- **SC-016**: A entrada pelo Fluig continua funcionando sem nenhuma mudança para quem a usa (mesmos
  testes de US1–US6 passando com token Fluig).

## Assumptions

- A Jotanunes consegue configurar no Fluig a abertura do sistema entregando a identidade do usuário
  logado de forma assinada; quem pode abrir o sistema é definido por grupos/perfis no próprio Fluig.
  ~~Todos os usuários que o Fluig deixa entrar têm as mesmas permissões~~ (substituída em
  2026-09-29): há dois perfis, administrador e comum; a TI inclui o papel `admin` no token a partir
  de um grupo do Fluig (`contracts/fluig-identity.md`).
- ~~Não há tela no sistema para gerenciar administradores: quem é administrador é decidido só no
  Fluig.~~ (substituída em 2026-09-29, Session "login próprio") Na entrada pelo Fluig, quem é
  administrador continua decidido só no Fluig; para os usuários internos do login próprio, a tela
  "Usuários" (só administradores) define quem é administrador.
- A Jotanunes não tem acesso ao Fluig no momento (2026-09-29); o login próprio é a entrada principal
  até lá, e a entrada pelo Fluig continua pronta para quando existir.
- Usuários internos e usuários do Fluig não são unificados: um colaborador pode ter os dois acessos,
  e o sistema não liga um ao outro (a auditoria registra a origem).
- Um acesso ao portal por empresa (CNPJ); não há vários usuários por empresa na v1.
- Não há recuperação de senha self-service na v1: a empresa pede à Jotanunes, que reenvia o convite;
  o usuário interno pede a um administrador, que redefine a senha (FR-116).
- Validade/vencimento de documentos (ex.: certidões que vencem) está fora do escopo da v1.
- Os arquivos são guardados enquanto a empresa existir; política de descarte será definida com o
  jurídico da Jotanunes.
- Volume esperado: dezenas de obras, centenas de empresas, dezenas de milhares de envios por ano.
- Interface e e-mails em português do Brasil; horários em America/Sao_Paulo.
- Aplicativo móvel nativo, integração com outros módulos TOTVS além da identidade Fluig e assinatura
  digital de documentos estão fora do escopo.

### Outras decisões assumidas (a validar com Gustavo/Jotanunes)

Além das 5 perguntas formais do clarify (limite do Spec Kit), estes pontos foram decididos com a
opção mais razoável e também precisam de validação:

- Convite expira em 7 dias; reenvio a qualquer momento invalida o anterior e redefine o acesso
  (serve também como "esqueci minha senha").
- Bloqueio de 15 minutos após 5 tentativas erradas de senha por CNPJ.
- Sessão da empresa de 8 horas, sem "lembrar de mim".
- A empresa só pode enviar arquivo para documento "Pendente de envio" ou "Rejeitado"; não pode
  substituir arquivo "Em análise" nem "Aprovado". A Jotanunes não reabre documento aprovado na v1.
- A empresa recebe e-mail apenas na rejeição (não na aprovação), para reduzir ruído.
- ~~Todos os usuários que o Fluig deixa abrir o sistema têm as mesmas permissões (sem papéis na
  v1).~~ Substituída pela decisão validada de 2026-09-29 (perfis administrador e comum, US6).
- Nada é excluído definitivamente pela interface (desativação), exceto vínculos obra–empresa.
- O CNPJ fica bloqueado para edição depois do primeiro convite.
