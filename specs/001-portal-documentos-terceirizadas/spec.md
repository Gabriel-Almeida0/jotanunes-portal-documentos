# Feature Specification: Portal de Documentação de Terceirizadas Jotanunes

**Feature Branch**: `001-portal-documentos-terceirizadas`

**Created**: 2026-09-28

**Status**: Draft

**Input**: User description: "A Jotanunes (construtora) precisa acionar as empresas terceirizadas contratadas para que enviem documentos, e analisar esses documentos. Dois sistemas: (1) lado Jotanunes, aberto de dentro do Fluig, sem login próprio, para cadastrar obras, empresas (com e-mail de contato), vincular empresas às obras, cadastrar tipos de documento (os mesmos para todas as empresas), disparar e-mail de convite com link para o portal e analisar os documentos (aprovar/rejeitar com motivo); (2) portal da empresa terceirizada, com login por CNPJ + senha, onde a empresa vê os documentos exigidos, anexa arquivos, acompanha o status e reenvia os rejeitados." (fonte: `docs/transcricao.txt`)

## Visão geral

Hoje a Jotanunes pede os documentos das empresas terceirizadas de forma manual. A plataforma
organiza esse ciclo em duas partes:

- **Área Jotanunes** (aberta de dentro do Fluig): a equipe cadastra obras, empresas e tipos de
  documento, vincula empresas às obras, convida a empresa por e-mail e analisa o que chega.
- **Portal da terceirizada**: a empresa entra com CNPJ e senha, vê o que falta, envia os arquivos e
  acompanha a análise.

### Atores

| Ator | Quem é | Como acessa |
|---|---|---|
| **Analista Jotanunes** | Colaborador da Jotanunes com acesso ao sistema no Fluig | Pelo Fluig, que já identifica o usuário e controla quem pode abrir o sistema |
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

## Clarifications

### Session 2026-09-28

> Sem humano disponível para responder durante o `/speckit-clarify`. Cada resposta abaixo é a opção
> recomendada, marcada como **Decisão assumida (a validar com Gustavo/Jotanunes)**.

- Q: Quem define a senha da empresa no portal? → A: A Jotanunes (o sistema) gera uma senha
  temporária aleatória enviada no convite; a empresa é obrigada a trocá-la no primeiro acesso.
  **Decisão assumida (a validar com Gustavo/Jotanunes)** — é o fluxo descrito no áudio; a decisão
  final ficou com o Gustavo.
- Q: Os documentos são exigidos por empresa ou por empresa + obra? → A: Por empresa. Um envio
  aprovado vale para todas as obras em que a empresa atua; o vínculo com a obra serve para a
  Jotanunes organizar e filtrar. **Decisão assumida (a validar com Gustavo/Jotanunes)** — o áudio
  descreve "obra, empresas e das empresas os documentos", com os mesmos tipos para todas; documentos
  como cartão CNPJ e certidões são da empresa, e pedir de novo por obra geraria retrabalho.
- Q: Quais tipos de documento são exigidos de cada empresa? → A: Todos os tipos de documento ativos
  do catálogo são exigidos de todas as empresas ativas; não há seleção por empresa na v1.
  **Decisão assumida (a validar com Gustavo/Jotanunes)** — resposta do áudio: "os mesmos tipos".
- Q: Quais formatos e qual tamanho de arquivo são aceitos? → A: PDF, JPEG e PNG, até 10 MB, um
  arquivo por envio. **Decisão assumida (a validar com Gustavo/Jotanunes)** — PDF cobre a maioria
  dos documentos; imagens cobrem fotos de documentos tirados no celular.
- Q: A senha temporária pode ir no mesmo e-mail do link do convite? → A: Sim, no mesmo e-mail (há um
  único contato por empresa), mitigado por expiração em 7 dias, uso único e troca obrigatória no
  primeiro acesso; a senha temporária nunca é exibida na área Jotanunes. **Decisão assumida (a
  validar com Gustavo/Jotanunes)**.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cadastros da Jotanunes: tipos de documento, obras, empresas e vínculos (Priority: P1)

A analista Jotanunes abre o sistema pelo Fluig, sem nova tela de login. Ela cadastra os tipos de
documento que a Jotanunes exige, cadastra as obras, cadastra as empresas terceirizadas (razão
social, CNPJ e e-mail de contato) e indica quais empresas atuam em cada obra.

**Why this priority**: sem esse cadastro não existe a quem pedir documentos nem o que pedir. É a
base de todas as outras histórias.

**Independent Test**: abrindo o sistema com uma identidade Fluig válida, é possível cadastrar 2
tipos de documento, 1 obra, 2 empresas, vincular as duas à obra e ver a lista "Empresas da obra"
com as duas.

**Acceptance Scenarios**:

1. **Given** um usuário identificado pelo Fluig, **When** ele abre o sistema, **Then** vê a tela
   inicial com o nome dele, sem pedido de login.
2. **Given** alguém tentando abrir o sistema sem identidade Fluig válida (ausente, expirada ou
   adulterada), **When** a tela carrega, **Then** nenhum dado é exibido e aparece a mensagem
   "Abra este sistema pelo Fluig.".
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

**Independent Test**: com um envio "Em análise", a analista rejeita com motivo; a empresa vê
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

## Requirements *(mandatory)*

### Functional Requirements

**Acesso e identidade**

- **FR-001**: A área Jotanunes DEVE ser acessível somente com uma identidade de usuário emitida pelo
  Fluig (login, nome e e-mail), sem tela de login própria; o controle de quem pode abrir o sistema é
  do Fluig.
- **FR-002**: O sistema DEVE recusar pedidos da área Jotanunes com identidade ausente, expirada,
  adulterada ou emitida para o portal.
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
  definido pelo Fluig (máximo 8 horas).

**Cadastros (área Jotanunes)**

- **FR-010**: A analista DEVE poder cadastrar, editar, listar e ativar/desativar obras (nome,
  código interno opcional, cidade, UF).
- **FR-011**: A analista DEVE poder cadastrar, editar, listar e ativar/desativar empresas (razão
  social, nome fantasia opcional, CNPJ, e-mail de contato, nome do contato e telefone opcionais).
- **FR-012**: O CNPJ DEVE ser único, validado pelos dígitos verificadores (aceitando o formato
  numérico e o alfanumérico da Receita Federal, vigente desde julho de 2026) e armazenado sem máscara;
  o CNPJ não pode ser alterado depois do primeiro convite.
- **FR-013**: A analista DEVE poder vincular e desvincular empresas de obras; uma empresa pode estar
  em várias obras e uma obra pode ter várias empresas.
- **FR-014**: A analista DEVE poder cadastrar, editar, listar e ativar/desativar tipos de documento
  (nome único, instruções para a empresa).
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
- **FR-042**: A analista DEVE poder aprovar ou rejeitar um envio "Em análise"; rejeitar exige motivo
  de 5 a 500 caracteres.
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
  troca de senha, envio de convite, envio de documento, download de arquivo e decisão de análise,
  com quem, quando e qual recurso — sem gravar senhas, tokens ou conteúdo de arquivos.
- **FR-062**: As mensagens de erro de login NÃO DEVEM revelar se o CNPJ existe.

**Interface**

- **FR-070**: As duas interfaces DEVEM seguir o guia visual `docs/design.md` (cores, tipografia
  Montserrat, forma-assinatura, tom de voz) e atingir contraste WCAG AA.
- **FR-071**: A área Jotanunes NÃO DEVE ter cabeçalho de marca próprio (é exibida dentro do Fluig);
  o portal DEVE ter cabeçalho com logo, nome da empresa logada e "Sair".
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
- **Tipo de documento**: nome (único), instruções, ativo/inativo. Catálogo único da Jotanunes.
- **Convite**: empresa, e-mail de destino, quem enviou, quando, expiração, quando foi usado ou
  substituído.
- **Envio de documento**: empresa, tipo de documento, arquivo (nome original, formato, tamanho),
  data/hora do envio, situação (Em análise, Aprovado, Rejeitado), analista, data/hora e motivo da
  decisão.
- **Situação do documento** (derivada): para cada empresa × tipo ativo, a situação do envio mais
  recente, ou "Pendente de envio" se não houver envio.
- **Registro de auditoria**: ação, ator (usuário Fluig ou empresa), recurso, data/hora, IP.

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

## Assumptions

- A Jotanunes consegue configurar no Fluig a abertura do sistema entregando a identidade do usuário
  logado de forma assinada; quem pode abrir o sistema é definido por perfis no próprio Fluig. Todos
  os usuários que o Fluig deixa entrar têm as mesmas permissões (não há papéis diferentes na v1).
- Um acesso ao portal por empresa (CNPJ); não há vários usuários por empresa na v1.
- Não há recuperação de senha self-service na v1: a empresa pede à Jotanunes, que reenvia o convite.
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
- Todos os usuários que o Fluig deixa abrir o sistema têm as mesmas permissões (sem papéis na v1).
- Nada é excluído definitivamente pela interface (desativação), exceto vínculos obra–empresa.
- O CNPJ fica bloqueado para edição depois do primeiro convite.
