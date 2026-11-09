# Feature Specification: Documentos por obra

**Feature Branch**: `002-documentos-por-obra`

**Created**: 2026-10-26

**Status**: Draft

**Input**: User description: "Documentos estão relacionados à empresa; vamos precisar refatorar o sistema para que os
documentos da empresa sejam específicos para cada obra: obra → empresa → documentos, sendo que uma empresa pode ter
vários documentos diferentes para obras diferentes. Isso deve ficar organizado na UI/UX também, nos 2 sistemas
(área Jotanunes e portal da terceirizada)."

**Feature base**: [`001-portal-documentos-terceirizadas`](../001-portal-documentos-terceirizadas/spec.md). Esta
feature altera regras validadas na 001 (FR-015 e a decisão "documentos são por empresa" de 2026-09-29). Tudo que não
é citado aqui continua valendo como está na 001.

## Contexto

Hoje todo tipo de documento ativo é exigido de toda empresa ativa, e um envio vale para todas as obras da empresa; o
vínculo obra–empresa só organiza e filtra. Na prática, cada obra pede documentos próprios (ex.: ART do serviço
daquela obra, PGR/PCMSO do canteiro, ordem de serviço), e a mesma empresa precisa mandar um arquivo diferente para
cada obra em que atua. Outros documentos continuam sendo da empresa como um todo (Cartão CNPJ, Contrato Social,
certidões) e não fazem sentido por obra.

## Clarifications

### Session 2026-10-26

> Respostas dadas pelo usuário (dono do produto). São fonte de verdade e não devem ser reabertas.

- Q: Quais tipos de documento são exigidos de uma empresa em cada obra? → A: **Cada obra escolhe** a sua lista de
  tipos exigidos; a lista vale para todas as empresas vinculadas àquela obra. **VALIDADA** — substitui, para os
  documentos por obra, a regra "todo tipo ativo é exigido de toda empresa" (FR-015 da 001).
- Q: Algum documento continua valendo para todas as obras da empresa? → A: **Sim.** Continuam existindo os
  documentos **gerais da empresa** (como hoje: enviados uma vez, valem em todas as obras); a feature **acrescenta**
  o tipo de documento **por obra**. **VALIDADA**.
- Q: O que fazer com os envios que já existem? → A: **Ficam como gerais.** Os tipos e envios existentes passam a
  ser documentos gerais da empresa, sem mudança de situação nem de histórico. **VALIDADA**.
- Q: O que acontece ao desvincular uma empresa de uma obra em que ela já enviou documentos? → A: **Encerrar e
  guardar histórico.** O vínculo fica encerrado: some do portal e das pendências, mas envios e análises continuam
  consultáveis na área Jotanunes; vincular de novo reabre o vínculo com o histórico. **VALIDADA** — substitui
  "desvincular remove a linha" da 001.

## Glossário (novos termos e termos alterados)

- **Abrangência do tipo de documento**: *Geral da empresa* (enviado uma vez, vale para todas as obras) ou *Por
  obra* (enviado e analisado separadamente em cada obra que o exige). Todo tipo tem exatamente uma abrangência.
- **Documentos exigidos da obra**: lista de tipos *por obra* que uma obra pede das empresas vinculadas a ela.
- **Vínculo ativo / encerrado**: o vínculo obra–empresa deixa de ser apagado ao desvincular; passa a *encerrado*.
- **Documento da obra**: a combinação obra × empresa × tipo por obra, com a sua situação (Pendente de envio, Em
  análise, Aprovado, Rejeitado) e o seu histórico de envios, independente das outras obras da mesma empresa.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tipo de documento com abrangência e documentos exigidos por obra (Priority: P1)

O administrador cadastra tipos de documento escolhendo a abrangência (geral da empresa ou por obra) e, no cadastro
de cada obra, marca quais tipos *por obra* aquela obra exige.

**Why this priority**: sem essa configuração não existe documento por obra; é a base das demais histórias.

**Independent Test**: criar o tipo "ART da obra" como *Por obra*, abrir a obra A e marcá-lo como exigido; a obra B
não o marca. A lista de exigidos da obra A mostra "ART da obra"; a da obra B não.

**Acceptance Scenarios**:

1. **Given** a tela de tipos de documento, **When** o administrador cria um tipo, **Then** escolhe obrigatoriamente
   a abrangência *Geral da empresa* ou *Por obra*, e a lista de tipos mostra a abrangência de cada um (texto, não só
   cor) com filtro por abrangência.
2. **Given** tipos que já existiam antes desta feature, **When** a lista é aberta, **Then** todos aparecem como
   *Geral da empresa*, com os mesmos envios e situações de antes.
3. **Given** uma obra, **When** o administrador abre "Documentos exigidos" da obra, **Then** vê os tipos *por obra*
   ativos e pode marcar e desmarcar quais a obra exige; tipos gerais não aparecem nessa escolha (aparecem só como
   informação: "Também são exigidos os documentos gerais da empresa").
4. **Given** uma obra com empresas vinculadas, **When** o administrador marca um tipo como exigido, **Then** o
   documento passa a "Pendente de envio" para cada empresa ativa vinculada àquela obra, e só nela.
5. **Given** um tipo exigido por uma obra com envios já feitos, **When** o administrador o desmarca, **Then** ele
   deixa de ser exigido (sai das pendências e do portal naquela obra), mas os envios continuam no histórico da área
   Jotanunes; envio "Em análise" ainda pode ser analisado; marcar de novo traz o documento de volta com o histórico.
6. **Given** um tipo com envios, **When** o administrador tenta trocar a abrangência, **Then** o sistema recusa com
   mensagem explicando que a abrangência só muda enquanto o tipo não tiver envios.
7. **Given** um usuário comum, **When** abre tipos ou "Documentos exigidos" da obra, **Then** vê tudo em modo
   leitura; tentativas de alterar pela API recebem 403 (regra de perfis da 001).

---

### User Story 2 - Empresa envia documentos de cada obra pelo portal (Priority: P1)

A empresa entra no portal e vê os documentos organizados em **Documentos gerais da empresa** e, separadamente,
**um grupo por obra** em que está vinculada, cada um com a sua situação. Ela envia e acompanha cada documento no
contexto da obra certa.

**Why this priority**: é o objetivo da mudança do ponto de vista da empresa.

**Independent Test**: empresa vinculada às obras A e B, com "ART da obra" exigido nas duas. Enviar um PDF para a
obra A: na obra A fica "Em análise"; na obra B continua "Pendente de envio"; os gerais não mudam.

**Acceptance Scenarios**:

1. **Given** uma empresa autenticada vinculada a duas obras ativas, **When** abre o portal, **Then** vê um resumo
   com "Documentos gerais" e cada obra (nome, cidade/UF e progresso, ex.: "2 de 3 aprovados"), com destaque para o
   que está pendente ou rejeitado.
2. **Given** o resumo, **When** a empresa escolhe uma obra, **Then** vê só os documentos exigidos daquela obra, com
   nome, instruções, situação escrita e a ação disponível (Enviar / Enviar novo arquivo / histórico); o nome da obra
   fica visível o tempo todo para não enviar no lugar errado.
3. **Given** um documento da obra A "Pendente de envio", **When** a empresa envia um arquivo aceito, **Then** só
   aquele documento da obra A passa a "Em análise"; o mesmo tipo em outra obra não muda.
4. **Given** um documento da obra "Rejeitado", **When** a empresa abre a obra, **Then** vê o motivo e "Enviar novo
   arquivo"; ao reenviar, volta a "Em análise" naquela obra.
5. **Given** um vínculo encerrado ou uma obra inativa, **When** a empresa abre o portal, **Then** essa obra não
   aparece e qualquer envio para ela é recusado como "não encontrado".
6. **Given** a empresa A, **When** tenta ver, baixar ou enviar documento de uma obra em que ela não está vinculada,
   ou de outra empresa (inclusive alterando endereços), **Then** o sistema responde como se o recurso não existisse.
7. **Given** uma empresa sem nenhuma obra ativa vinculada, **When** abre o portal, **Then** vê os documentos gerais
   e a mensagem "Você ainda não está em nenhuma obra. Quando a Jotanunes vincular sua empresa a uma obra, os
   documentos dela aparecem aqui.".
8. **Given** uma obra cujos documentos estão todos aprovados (ou sem tipos exigidos), **When** a empresa a abre,
   **Then** vê "Tudo certo nesta obra." e o histórico continua acessível.

---

### User Story 3 - Análise dos documentos com a obra no contexto (Priority: P1)

A analista vê na fila e no detalhe de cada envio a qual obra ele pertence (ou "Geral da empresa"), filtra a fila por
obra e analisa normalmente. O e-mail de rejeição informa a obra.

**Why this priority**: sem a obra no contexto, a analista não sabe para qual canteiro o documento vale.

**Independent Test**: com envios da mesma empresa e mesmo tipo nas obras A e B, a fila mostra duas linhas com a
obra de cada uma; filtrar por "Obra A" mostra só a da obra A; rejeitar a da obra A não muda a da obra B.

**Acceptance Scenarios**:

1. **Given** envios gerais e por obra "Em análise", **When** a analista abre a fila, **Then** cada linha mostra
   empresa, tipo, **obra (ou "Geral da empresa")** e data, e o filtro por obra traz os envios daquela obra; um filtro
   "Somente gerais" traz os gerais.
2. **Given** um envio por obra, **When** a analista abre o detalhe, **Then** vê obra, empresa e tipo no topo e o
   histórico apenas daquele documento naquela obra.
3. **Given** um envio por obra, **When** a administradora rejeita com motivo, **Then** o e-mail à empresa cita o
   documento **e a obra**.
4. **Given** um envio "Em análise" de um vínculo encerrado ou de um tipo desmarcado da obra, **When** a
   administradora o analisa, **Then** a decisão é aceita normalmente (não se perde trabalho pendente).

---

### User Story 4 - Acompanhamento organizado por obra e por empresa na área Jotanunes (Priority: P2)

No detalhe da obra, a analista vê as empresas vinculadas e o progresso de cada uma nos documentos daquela obra e nos
gerais. No detalhe da empresa, vê os gerais e um bloco por obra. O painel conta pendências gerais e por obra.

**Why this priority**: organiza o acompanhamento; o processo de envio e análise funciona sem ele.

**Independent Test**: com dados de exemplo, as contagens do detalhe da obra, do detalhe da empresa e do painel
batem com as calculadas à mão.

**Acceptance Scenarios**:

1. **Given** uma obra com empresas vinculadas, **When** a analista abre a obra, **Then** vê abas ou seções
   "Empresas" (cada empresa com o progresso **dos documentos desta obra** e, à parte, o resumo dos gerais) e
   "Documentos exigidos"; empresas com vínculo encerrado aparecem numa seção recolhida "Vínculos encerrados".
2. **Given** uma empresa, **When** a analista abre o detalhe, **Then** vê "Documentos gerais" e um bloco por obra
   vinculada (ativa), cada um com situação por documento e acesso ao histórico; obras com vínculo encerrado ficam
   recolhidas, só com histórico.
3. **Given** dados cadastrados, **When** a analista abre o painel, **Then** "empresas com pendência" considera
   pendências gerais e por obra (de vínculos ativos em obras ativas), e existe um indicador/lista de **obras com
   pendência**.
4. **Given** a lista de empresas filtrada por obra, **When** a analista olha o progresso, **Then** a contagem
   mostrada é a dos documentos daquela obra mais os gerais, identificados separadamente.

---

### User Story 5 - Encerrar e reabrir vínculo sem perder histórico (Priority: P2)

O administrador desvincula uma empresa de uma obra; o vínculo fica encerrado e o histórico de documentos daquela obra
é preservado. Vincular de novo reabre o vínculo.

**Why this priority**: protege o histórico de análise (exigência de auditoria/LGPD) com a nova regra por obra.

**Independent Test**: empresa com envio aprovado na obra A; desvincular; o portal deixa de mostrar a obra A e a área
Jotanunes mostra o envio em "Vínculos encerrados"; vincular de novo: a obra A volta ao portal com o envio aprovado.

**Acceptance Scenarios**:

1. **Given** um vínculo ativo com envios, **When** o administrador desvincula, **Then** o sistema pede confirmação
   informando quantos documentos da obra a empresa já enviou, e o vínculo passa a encerrado (quem e quando).
2. **Given** um vínculo encerrado, **When** o administrador vincula de novo a mesma empresa à mesma obra, **Then** o
   vínculo volta a ativo, e as situações anteriores (incluindo aprovados) voltam a valer.
3. **Given** um vínculo encerrado, **When** a analista consulta a obra ou a empresa, **Then** consegue abrir os
   envios e baixar arquivos daquele vínculo.

---

### Edge Cases

- Tipo *por obra* desativado: sai das listas de exigidos de todas as obras (mantendo a marcação para quando for
  reativado), envios ficam no histórico e "Em análise" ainda pode ser analisado.
- Obra desativada: seus documentos saem do portal e das pendências; envios em análise ainda podem ser analisados;
  reativar a obra traz tudo de volta.
- Empresa vinculada a uma obra depois de a obra já ter tipos exigidos: todos aparecem "Pendente de envio" para ela
  naquela obra.
- Mesmo tipo exigido em várias obras: cada obra tem a sua situação; aprovar numa não aprova nas outras.
- Duas abas enviando para o mesmo documento da mesma obra ao mesmo tempo: só o primeiro envio é aceito. Abas
  enviando o mesmo tipo para obras **diferentes**: os dois são aceitos.
- Tipo geral nunca aparece em "Documentos exigidos" de obra; tipo por obra nunca aparece em "Documentos gerais".
- Troca de abrangência de tipo sem envios: permitida; se era *por obra* e estava marcado em obras, as marcações são
  removidas (com aviso antes de confirmar).
- Convite (e-mail) de empresa vinculada a várias obras: continua listando as obras ativas vinculadas.
- Download de arquivo pelo portal de vínculo encerrado: recusado como "não encontrado" (a empresa só vê obras
  ativas); a área Jotanunes continua podendo baixar.

## Requirements *(mandatory)*

### Functional Requirements

**Abrangência e configuração**

- **FR-200**: Todo tipo de documento DEVE ter uma abrangência: *Geral da empresa* ou *Por obra*, escolhida pelo
  administrador no cadastro e exibida em texto nas listas, com filtro por abrangência.
- **FR-201**: Os tipos de documento e envios existentes antes desta feature DEVEM passar a ser *Geral da empresa*,
  sem alterar situação, histórico, autoria ou arquivos.
- **FR-202**: Documentos *gerais* DEVEM seguir a regra da 001: todo tipo geral ativo é exigido de toda empresa
  ativa, e um envio vale para todas as obras da empresa.
- **FR-203**: O administrador DEVE poder marcar e desmarcar, em cada obra, quais tipos *por obra* ativos ela
  exige. A lista DEVE valer para todas as empresas com vínculo ativo naquela obra.
- **FR-204**: Um documento por obra DEVE ser exigido de uma empresa somente quando: a empresa está ativa, o vínculo
  com a obra está ativo, a obra está ativa, o tipo está ativo e marcado como exigido pela obra.
- **FR-205**: A abrangência de um tipo SÓ PODE ser trocada enquanto o tipo não tiver nenhum envio; trocar de *por
  obra* para *geral* remove as marcações nas obras.
- **FR-206**: O catálogo padrão da 001 (FR-090) DEVE ser criado com abrangência *Geral da empresa*.

**Envio e situação por obra**

- **FR-210**: A situação de um documento por obra (Pendente de envio, Em análise, Aprovado, Rejeitado + motivo) DEVE
  ser calculada por obra × empresa × tipo, independente das outras obras da mesma empresa.
- **FR-211**: A empresa DEVE poder enviar arquivo para um documento por obra "Pendente de envio" ou "Rejeitado" em
  obra com vínculo ativo; não pode haver dois envios "Em análise" ou "Aprovado" para a mesma obra × empresa × tipo.
- **FR-212**: Formatos, tamanho, validação de conteúdo e histórico de envios (FR-032–FR-034 da 001) DEVEM valer
  igualmente para documentos por obra.
- **FR-213**: Uma empresa NUNCA DEVE conseguir listar, ver, baixar ou enviar documentos de obra em que não tenha
  vínculo ativo, nem de outra empresa; tentativas DEVEM ser respondidas como "não encontrado". A obra do envio DEVE
  ser verificada no servidor contra os vínculos da empresa do token.

**Vínculo**

- **FR-220**: Desvincular DEVE encerrar o vínculo (registrando quem e quando) em vez de apagá-lo; envios e análises
  daquele vínculo DEVEM continuar consultáveis e baixáveis na área Jotanunes.
- **FR-221**: Vincular de novo uma empresa a uma obra com vínculo encerrado DEVE reabrir o mesmo vínculo, mantendo o
  histórico e as situações anteriores.
- **FR-222**: Ao desvincular, a área Jotanunes DEVE pedir confirmação informando quantos envios a empresa já fez
  naquela obra.

**Análise e e-mails**

- **FR-230**: A fila de análise, o detalhe do envio e o histórico DEVEM mostrar a obra do envio ou "Geral da
  empresa"; a fila DEVE filtrar por obra específica e por "Somente gerais".
- **FR-231**: Envios "Em análise" DEVEM poder ser analisados mesmo que o vínculo tenha sido encerrado, a obra
  desativada ou o tipo desmarcado/desativado.
- **FR-232**: O e-mail de rejeição de um documento por obra DEVE informar o nome da obra.

**Organização na área Jotanunes**

- **FR-240**: O detalhe da obra DEVE ter: "Empresas" (progresso de cada empresa nos documentos desta obra e resumo
  separado dos gerais), "Documentos exigidos" (configuração, só administrador altera) e "Vínculos encerrados"
  (recolhido, com histórico).
- **FR-241**: O detalhe da empresa DEVE mostrar "Documentos gerais" e um bloco por obra com vínculo ativo (situação
  por documento e histórico), além de obras com vínculo encerrado, recolhidas.
- **FR-242**: O painel DEVE contar como "empresa com pendência" quem tem documento pendente ou rejeitado, geral ou
  por obra (só vínculos ativos em obras ativas), e DEVE mostrar quantas obras têm alguma pendência, com acesso à
  lista.

**Organização no portal**

- **FR-250**: O portal DEVE abrir num resumo com "Documentos gerais" e um cartão por obra ativa vinculada (nome,
  cidade/UF, progresso escrito, quantidade pendente/rejeitada), ordenando primeiro o que tem pendência.
- **FR-251**: Ao abrir uma obra no portal, o nome da obra DEVE ficar visível durante toda a navegação, no envio e no
  histórico.
- **FR-252**: Estados vazios DEVEM ter mensagem própria: sem obras vinculadas; obra sem tipos exigidos; obra com tudo
  aprovado.

**Auditoria e contrato**

- **FR-260**: A auditoria DEVE registrar, além do que a 001 registra: mudança de abrangência de tipo, marcação e
  desmarcação de tipo exigido em obra, encerramento e reabertura de vínculo; o envio de documento por obra DEVE
  registrar a obra.
- **FR-261**: A identificação de obra nos envios por obra DEVE fazer parte do contrato da API entre os três sistemas,
  atualizado antes da implementação (princípio II da constituição).

### Key Entities

- **Tipo de documento** (alterado): ganha a **abrangência** (Geral da empresa | Por obra).
- **Documento exigido da obra** (novo): obra, tipo *por obra*, quem marcou e quando. Único por obra × tipo.
- **Vínculo obra–empresa** (alterado): passa a ter situação ativo/encerrado, com quem encerrou/reabriu e quando.
- **Envio de documento** (alterado): passa a ter **obra** opcional — vazia para tipos gerais, obrigatória para tipos
  por obra. A regra "um envio não rejeitado por documento" vale por empresa × tipo (gerais) e por obra × empresa ×
  tipo (por obra).
- **Situação do documento** (derivada, alterada): calculada por empresa × tipo geral e por obra × empresa × tipo por
  obra.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-200**: O administrador configura os documentos exigidos de uma obra nova (marcar 5 tipos) em menos de 1
  minuto.
- **SC-201**: Em teste com empresas reais ou de exemplo, 100% dos envios por obra ficam associados à obra escolhida
  pela empresa, e nenhum aparece em outra obra.
- **SC-202**: Uma empresa vinculada a 3 obras identifica, no primeiro acesso e sem ajuda, o que está pendente em cada
  obra em menos de 30 segundos.
- **SC-203**: Depois da atualização, 100% dos envios existentes continuam visíveis com a mesma situação, como
  documentos gerais.
- **SC-204**: Nenhuma tentativa de acessar documento de obra sem vínculo ativo (pelo portal) ou de outra empresa
  tem sucesso nos testes de autorização.
- **SC-205**: As contagens do painel, do detalhe da obra e do detalhe da empresa batem com a contagem manual em 100%
  dos cenários de teste.
- **SC-206**: Encerrar e reabrir um vínculo preserva 100% do histórico de envios e análises daquele vínculo.

## Assumptions

- A lista de tipos exigidos é **da obra** (vale para todas as empresas vinculadas); não há exceção por empresa
  dentro da obra nesta versão.
- Um documento geral não substitui um documento por obra, mesmo que seja do mesmo assunto: são tipos diferentes no
  catálogo.
- Validade/vencimento dos documentos continua fora do escopo, como na 001.
- Não há cópia automática de documento entre obras (cada obra recebe o seu envio); reaproveitar o mesmo arquivo em
  outra obra é feito enviando de novo.
- Volume: dezenas de obras, centenas de empresas, até ~10 tipos por obra; o portal e as telas devem continuar
  rápidos nesse volume (metas de desempenho da 001).
- Perfis (administrador × comum), isolamento entre empresas, auditoria, identidade visual e as duas entradas da área
  Jotanunes seguem a 001 e a constituição sem mudança.
