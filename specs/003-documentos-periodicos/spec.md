# Feature Specification: Documentos periódicos

**Feature Branch**: `003-documentos-periodicos`

**Created**: 2026-10-26

**Status**: Draft

**Input**: User description: "Além da abrangência, deve ter tipos de documentos que são enviados mensalmente ou em
períodos de tempo personalizados; deve ter como configurar isso no cadastro."

**Base**: features [001](../001-portal-documentos-terceirizadas/spec.md) e [002 — documentos por obra](../002-documentos-por-obra/spec.md).
Tudo que não é citado aqui continua como lá.

## Contexto

Alguns documentos não são enviados uma vez só: a guia do FGTS, a folha de pagamento e o comprovante de recolhimento
do INSS de cada mês, relatórios trimestrais, o PGR anual. Hoje um documento aprovado fica aprovado para sempre; a
Jotanunes precisa cobrar **um arquivo por período** (competência) e ver quais períodos estão faltando ou atrasados.

## Clarifications

### Session 2026-10-26

> Respostas dadas pelo usuário (dono do produto). São fonte de verdade e não devem ser reabertas.

- Q: O que significa "enviado mensalmente"? → A: **Um envio por período.** Cada período (competência) precisa do
  próprio arquivo, com situação e análise próprias; períodos anteriores ficam no histórico. **VALIDADA**.
- Q: Quais períodos o administrador pode escolher? → A: **Lista pronta + personalizado**: Único (como hoje), Mensal,
  Bimestral, Trimestral, Semestral, Anual, "A cada N meses" e "A cada N dias". **VALIDADA**.
- Q: A partir de quando cobrar e até quando enviar? → A: **Desde o vínculo, com prazo.** A cobrança começa quando a
  empresa passa a dever o documento (vínculo com a obra ou marcação do tipo na obra; para gerais, cadastro da
  empresa ou do tipo); cada período tem um prazo configurável no tipo; passado o prazo sem envio, o período fica
  **Atrasado**. **VALIDADA**.
- Q: Lembrete por e-mail? → A: **Não nesta versão**; atrasos aparecem no portal, no painel e nas listas. **VALIDADA**.

### Decisões assumidas (a validar com Gustavo/Jotanunes)

- O **prazo** é informado em **dias depois do fim do período** (0 a 90). Ex.: Mensal com prazo 15 = "até o dia 15 do
  mês seguinte".
- Os períodos em **meses** contam a partir do **mês de início da cobrança** (Mensal = meses do calendário; Trimestral
  que começa em fevereiro = fev–abr, mai–jul…). Os períodos em **dias** contam a partir do **dia de início**.
- A periodicidade vale para tipos **gerais e por obra**.
- A periodicidade de um tipo **só muda enquanto ele não tiver envios** (mesma regra da abrangência).
- A empresa pode enviar o arquivo do **período em curso** (antes de ele terminar) e de qualquer período passado
  exigido; nunca de período futuro.
- Ao **reabrir** um vínculo, a cobrança recomeça na data da reabertura; envios de períodos anteriores continuam no
  histórico.

## Glossário

- **Periodicidade do tipo**: Único (um envio vale para sempre, como hoje) ou recorrente (Mensal, Bimestral,
  Trimestral, Semestral, Anual, a cada N meses, a cada N dias).
- **Período** (competência): intervalo de datas a que um envio se refere. Rótulo: "Março/2026", "Jan–Mar/2026",
  "2026", "01/03 a 30/03/2026".
- **Início da cobrança**: primeiro dia do primeiro período exigido.
- **Prazo do período**: data-limite = fim do período + prazo do tipo.
- **Período atrasado**: período exigido cujo prazo passou sem envio em análise ou aprovado.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurar a periodicidade no tipo de documento (Priority: P1)

No cadastro do tipo (na tela "Tipos de documento" e no "Novo tipo por obra"), o administrador escolhe a
periodicidade e o prazo.

**Why this priority**: sem isso não existe documento periódico.

**Independent Test**: criar "Guia do FGTS" geral, Mensal, prazo 15 dias; a lista de tipos mostra "Mensal · até 15
dias após o período"; tentar mudar para Único depois de haver envio é recusado.

**Acceptance Scenarios**:

1. **Given** o formulário de tipo, **When** o administrador cria um tipo, **Then** escolhe a periodicidade (padrão
   "Único") e, se não for única, informa o prazo em dias depois do fim do período (0 a 90, padrão 15).
2. **Given** a periodicidade "A cada N meses" ou "A cada N dias", **When** o administrador salva, **Then** informa N
   (meses: 1 a 24; dias: 1 a 365).
3. **Given** tipos que já existiam, **When** a lista é aberta, **Then** todos aparecem como "Único", sem mudança de
   envios ou situação.
4. **Given** um tipo com envios, **When** o administrador tenta mudar a periodicidade, **Then** o sistema recusa
   explicando que ela só muda enquanto o tipo não tiver envios; o prazo pode mudar a qualquer momento (vale para todos
   os períodos, inclusive os passados).
5. **Given** a lista de tipos, **When** a analista olha, **Then** vê a periodicidade em texto e pode filtrar "Únicos" /
   "Periódicos".

---

### User Story 2 - Empresa envia o arquivo de cada período pelo portal (Priority: P1)

No portal, um documento periódico mostra os períodos exigidos, cada um com a sua situação, e a empresa envia o
arquivo do período certo.

**Why this priority**: é o objetivo da mudança.

**Independent Test**: empresa vinculada há 3 meses a uma obra que exige "Guia do FGTS" mensal com prazo 15: o portal
mostra 3 períodos passados + o mês em curso; os passados com prazo vencido aparecem "Atrasado"; enviar para fevereiro
muda só fevereiro.

**Acceptance Scenarios**:

1. **Given** um documento periódico, **When** a empresa abre a lista (gerais ou da obra), **Then** o cartão do
   documento mostra a periodicidade ("Mensal · até o dia 15 do mês seguinte"), a situação resumida (ex.: "2
   atrasados, 1 em análise") e o **próximo período a enviar** com o prazo.
2. **Given** o cartão, **When** a empresa abre "Períodos", **Then** vê a lista do mais recente para o mais antigo:
   rótulo do período, prazo, situação escrita (Pendente de envio, Atrasado, Em análise, Aprovado, Rejeitado + motivo)
   e a ação disponível (Enviar / Enviar novo arquivo / Histórico).
3. **Given** um período "Pendente de envio" ou "Atrasado", **When** a empresa envia um arquivo, **Then** só aquele
   período passa a "Em análise"; um envio fora do prazo continua aceito e fica marcado "enviado com atraso".
4. **Given** um período "Em análise" ou "Aprovado", **When** a empresa tenta enviar de novo para ele, **Then** a ação
   não aparece e o sistema recusa se forçada.
5. **Given** um período futuro (ainda não começou), **When** a empresa tenta enviar, **Then** o sistema recusa como
   "não encontrado".
6. **Given** um documento Único, **When** a empresa abre o portal, **Then** tudo funciona como antes (sem períodos).

---

### User Story 3 - Análise e acompanhamento por período na área Jotanunes (Priority: P1)

A fila, o detalhe do envio e o histórico mostram o período; o detalhe da empresa e da obra mostram os períodos
atrasados; o painel conta atrasos.

**Why this priority**: a analista precisa saber de qual competência é o arquivo e o que está faltando.

**Independent Test**: com envios de jan e fev da mesma empresa/tipo, a fila mostra duas linhas com o período; rejeitar
fevereiro não muda janeiro; o painel mostra quantas empresas têm período atrasado.

**Acceptance Scenarios**:

1. **Given** envios periódicos na fila, **When** a analista abre a fila, **Then** cada linha mostra o período
   ("Março/2026") ao lado do documento, e o envio com atraso aparece marcado; dá para filtrar por "Com atraso".
2. **Given** o detalhe de um envio periódico, **When** a analista abre, **Then** vê o período e o prazo dele e o
   histórico daquele período.
3. **Given** o detalhe da empresa (gerais ou bloco da obra) e a aba Empresas da obra, **When** a analista olha um
   documento periódico, **Then** vê a situação resumida e pode abrir a lista de períodos (mesma visão do portal, com
   quem analisou).
4. **Given** dados cadastrados, **When** a analista abre o painel, **Then** vê "empresas com período atrasado" (com
   lista) além dos indicadores atuais.
5. **Given** a rejeição de um envio periódico, **When** o e-mail sai, **Then** ele cita o período (e a obra, se for por
   obra).

### Edge Cases

- Tipo periódico criado hoje para empresa já ativa: o primeiro período é o que contém a data de início da cobrança
  (o mês corrente, no Mensal) — nunca cobra meses anteriores ao início.
- Tipo desmarcado na obra / desativado / vínculo encerrado: para de gerar períodos novos; períodos e envios
  anteriores continuam no histórico; envio "Em análise" ainda pode ser analisado.
- Remarcar tipo na obra ou reativar tipo: a cobrança recomeça na data da remarcação/reativação.
- Mudança de prazo: recalcula prazos e atrasos de todos os períodos (não muda envios).
- "A cada N dias" com N grande (ex.: 365): mesmo comportamento, rótulo por datas.
- Duas abas enviando para o mesmo período: só o primeiro é aceito; para períodos diferentes, ambos.
- Empresa com 2 anos de vínculo e documento Mensal: até 25 períodos listados; a lista mostra primeiro os que pedem
  ação e o resto recolhido.
- Fuso: períodos e prazos usam a data no fuso de Brasília (America/Sao_Paulo).

## Requirements *(mandatory)*

### Functional Requirements

**Configuração**

- **FR-300**: Todo tipo de documento DEVE ter uma periodicidade: Único, Mensal, Bimestral, Trimestral, Semestral,
  Anual, A cada N meses (N de 1 a 24) ou A cada N dias (N de 1 a 365). Padrão: Único.
- **FR-301**: Tipos periódicos DEVEM ter um prazo em dias depois do fim do período (0 a 90; padrão 15).
- **FR-302**: Tipos existentes DEVEM passar a Único, sem mudança de envios ou situação.
- **FR-303**: A periodicidade SÓ PODE mudar enquanto o tipo não tiver envios; o prazo pode mudar sempre.
- **FR-304**: A periodicidade vale para tipos gerais e por obra; o "Novo tipo por obra" da aba da obra também a
  oferece.

**Períodos e situação**

- **FR-310**: Para cada documento periódico exigido, o sistema DEVE calcular os períodos desde o início da cobrança
  até o período em curso. Início: gerais — a mais recente entre o cadastro da empresa e a criação (ou ativação) do
  tipo; por obra — a mais recente entre o vínculo (ou reabertura) e a marcação do tipo na obra (ou ativação).
- **FR-311**: Cada período DEVE ter situação própria (Pendente de envio, Em análise, Aprovado, Rejeitado) calculada
  pelos envios daquele período, e é **Atrasado** quando o prazo passou sem envio em análise ou aprovado.
- **FR-312**: A situação resumida do documento periódico DEVE ser: Rejeitado/Atrasado/Pendente se algum período
  exigido estiver assim (prioridade: Atrasado > Rejeitado > Pendente de envio > Em análise > Aprovado), com as
  contagens por situação.
- **FR-313**: A empresa DEVE poder enviar para o período em curso e para períodos passados exigidos em Pendente,
  Atrasado ou Rejeitado; não pode haver dois envios em análise ou aprovados para o mesmo período.
- **FR-314**: O envio DEVE registrar o período e se foi feito depois do prazo ("enviado com atraso").

**Contagens e painel**

- **FR-320**: As contagens de documentos (empresa, obra, portal) DEVEM contar o documento periódico **uma vez**, pela
  situação resumida (FR-312), e trazer à parte o número de **períodos atrasados**.
- **FR-321**: "Empresa com pendência" DEVE incluir quem tem período pendente, rejeitado ou atrasado.
- **FR-322**: O painel DEVE mostrar quantas empresas têm algum período atrasado, com acesso à lista filtrada.

**Análise e telas**

- **FR-330**: Fila, detalhe do envio, histórico e e-mail de rejeição DEVEM mostrar o período (rótulo) dos envios
  periódicos; a fila DEVE filtrar "Com atraso".
- **FR-331**: Portal e área Jotanunes DEVEM ter uma visão de "Períodos" do documento periódico (lista do mais recente
  ao mais antigo, os que pedem ação primeiro, antigos recolhidos), com envio por período no portal.
- **FR-332**: O formulário de tipo DEVE mostrar uma prévia em texto da regra (ex.: "Mensal · um arquivo por mês, até o
  dia 15 do mês seguinte").

**Auditoria e contrato**

- **FR-340**: A auditoria DEVE registrar mudança de periodicidade/prazo do tipo; o envio periódico registra o período
  no próprio envio.
- **FR-341**: Periodicidade, prazo, períodos e o período do envio DEVEM entrar no contrato da API antes da
  implementação.

### Key Entities

- **Tipo de documento** (alterado): + periodicidade (unidade: única | meses | dias; intervalo N) + prazo em dias.
- **Envio de documento** (alterado): + início e fim do período (vazios para Único) + "enviado com atraso".
- **Período** (derivado, não guardado): início, fim, prazo, situação, envio atual, atrasado.
- **Início da cobrança** (derivado): conforme FR-310 (precisa da data de marcação na obra e de ativação do tipo).

## Success Criteria *(mandatory)*

- **SC-300**: Configurar um tipo mensal com prazo leva menos de 1 minuto.
- **SC-301**: Em teste com uma empresa vinculada há 6 meses a um documento mensal, o portal lista exatamente os 7
  períodos esperados (6 passados + o em curso) com as situações corretas.
- **SC-302**: 100% dos envios periódicos ficam associados ao período escolhido e nenhum aparece em outro período.
- **SC-303**: Depois da atualização, 100% dos tipos e envios existentes continuam iguais (Únicos).
- **SC-304**: As contagens de atrasos no painel, no detalhe da empresa e no portal batem com a contagem manual.

## Assumptions

- Sem lembrete por e-mail nesta versão (validado).
- Validade/vencimento de documento único continua fora do escopo (é outra regra).
- Feriados e dias úteis não entram no prazo (dias corridos).
- Volume: até ~25 períodos por documento periódico; listas devem continuar rápidas (metas da 001).
