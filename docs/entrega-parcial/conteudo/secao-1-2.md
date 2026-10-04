<!-- ANCORA: 1.1 -->

#### Problema

A Jotanunes pede os documentos das terceirizadas de forma manual, por e-mail e mensagens, sem um lugar único que mostre o que cada empresa enviou, o que falta, o que foi recusado e por quê.

#### Solução

Plataforma web em duas partes: a área Jotanunes cadastra obras, empresas e documentos exigidos, convida por e-mail e analisa; no portal, a terceirizada entra com CNPJ e senha e envia os arquivos.

#### Onde a IA gera valor

A versão atual do produto não usa IA em produção; a IA foi usada no processo de construção (especificação, código, testes e documentação com agentes). No produto, propomos para a próxima etapa:

| Oportunidade | Tipo |
|---|---|
| Ler validade e emissor das certidões e alertar o vencimento | Automação / predição |
| Conferir se o arquivo enviado é do tipo pedido ou está ilegível | Predição |
| Resumir o envio para o analista e sugerir o motivo da rejeição | Geração de conteúdo |

#### Personas

| Persona | Necessidade |
|---|---|
| Administrador da Jotanunes | Cadastrar obras, empresas e tipos de documento e analisar os envios. |
| Usuário comum da Jotanunes | Consultar a situação das empresas e convidá-las. |
| Representante da terceirizada | Saber o que falta e enviar os documentos sem burocracia. |

<!-- ANCORA: 1.2 -->

| Cenário | Comportamento |
|---|---|
| Arquivo inválido, corrompido ou acima de 10 MB | Recusado com mensagem clara. |
| Convite expirado ou senha errada 5 vezes | Novo convite exigido / acesso bloqueado por 15 min. |
| Dois analistas decidem o mesmo envio | Só a primeira decisão vale. |
| Serviço de e-mail fora do ar | Convite não é registrado e o erro é exibido. |
| Empresa tenta ver documento de outra | Resposta "não encontrado". |
| IA proposta lê data errada ou alucina | Resultado sempre revisado por um humano antes de valer. |

<!-- ANCORA: 2.1 -->

| Épico | Histórias |
|---|---|
| Cadastros da Jotanunes | Cadastrar obras, empresas e tipos de documento; vincular empresas às obras. |
| Acesso da terceirizada | Convite por e-mail; login com CNPJ e senha; troca no primeiro acesso. |
| Envio e análise | Enviar documentos; aprovar ou rejeitar com motivo; acompanhar a situação. |
| Perfis e usuários | Administrador e usuário comum; login próprio; tela de usuários. |
| Painel | Indicadores de pendências por empresa e obra. |

As histórias foram quebradas em 176 tarefas (backend, área Jotanunes, portal e infraestrutura), todas concluídas.

**Uso de IA no projeto:** especificação com GitHub Spec Kit; implementação por agentes de IA (Claude Code) em paralelo, um por área, a partir de um contrato de API único; revisão, testes e integração feitos pelo orquestrador antes de cada commit.

<!-- ANCORA: 2.2 -->

| História | Critério de aceite |
|---|---|
| Convite | Ao convidar, a empresa recebe e-mail com link e senha provisória e precisa trocá-la no primeiro acesso. |
| Envio | Arquivo PDF, JPG ou PNG de até 10 MB fica "Em análise"; outros formatos são recusados. |
| Análise | Rejeição exige motivo, e a empresa vê o motivo e pode reenviar. |
| Perfis | Usuário comum não consegue cadastrar nem analisar (erro 403). |

**Como garantimos o resultado da IA:** todo código gerado passou por 728 testes automatizados, teste ponta a ponta no sistema real e revisão antes de ser aceito.
