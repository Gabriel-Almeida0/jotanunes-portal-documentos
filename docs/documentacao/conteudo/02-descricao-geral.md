# 2. Descrição Geral do Sistema

Este capítulo descreve de forma geral o sistema, o escopo e as principais funções, com o problema a resolver, os envolvidos e as regras de negócio.

## 2.1. Descrição do Problema

A Jotanunes Construtora contrata empresas terceirizadas para prestar serviços em suas obras. Para contratar e manter essas empresas, a Jotanunes precisa receber e conferir documentos que comprovam a regularidade de cada uma, como cartão CNPJ, contrato social, certidões negativas de débitos federais, estaduais, municipais e trabalhistas, certificado de regularidade do FGTS, programas de gerenciamento de riscos e de saúde ocupacional e a anotação de responsabilidade técnica.

Hoje esse pedido é feito de forma manual. Os arquivos chegam por canais diferentes, não há um lugar único que mostre o que cada empresa já enviou, o que está pendente e o que foi recusado, e o motivo de uma recusa nem sempre fica registrado. Com várias empresas em cada obra e empresas atuando em mais de uma obra, o acompanhamento depende de controles paralelos e da memória de quem cuida do processo.

Nesse contexto, o projeto desenvolve uma plataforma com duas partes. Na Área Jotanunes, aberta de dentro do Fluig ou com login próprio, a equipe cadastra as obras, as empresas (com e-mail de contato) e os tipos de documento exigidos, indica quais empresas atuam em cada obra, dispara o convite por e-mail e analisa os documentos recebidos, aprovando ou rejeitando com motivo. No Portal da Terceirizada, a empresa entra com CNPJ e senha, vê a lista de documentos exigidos com a situação de cada um, anexa os arquivos, acompanha a análise e reenvia os rejeitados.

A plataforma também precisa tratar a segurança e a privacidade como requisitos centrais. Os documentos contêm dados de empresas e, em alguns casos, de pessoas (sócios, responsáveis técnicos, trabalhadores). Por isso, uma empresa nunca pode ver os documentos de outra, os arquivos não podem ter endereço público, as senhas são guardadas de forma irreversível e as ações relevantes ficam registradas em trilha de auditoria. O controle de quem pode alterar cadastros e decidir análises é feito por perfis (administrador e usuário comum), verificados no servidor.

Por fim, como a Jotanunes ainda não tem acesso ao Fluig, a área Jotanunes ganhou um login próprio com usuários internos gerenciados no sistema, sem abandonar a entrada pelo Fluig, que continua pronta para quando estiver disponível.

## 2.2. Principais Envolvidos e suas Características

**Administradores da Jotanunes:** colaboradores com o perfil de administrador na área Jotanunes. Cadastram e mantêm obras, empresas, vínculos e tipos de documento, analisam os envios (aprovam ou rejeitam com motivo) e gerenciam os usuários internos do login próprio. Precisam de telas objetivas, com listas filtráveis, formulários validados e confirmação antes de ações com efeito relevante, como desativar uma empresa ou rejeitar um documento. Entram pelo Fluig, quando o papel de administrador vem do grupo configurado pela TI, ou pelo login próprio, quando o papel vem do cadastro.

**Usuários comuns da Jotanunes:** colaboradores que acompanham o processo sem alterar cadastros nem decidir análises. Consultam o painel, as listas, os detalhes de obras, empresas e envios, os históricos e os arquivos, e podem enviar e reenviar convites às empresas. Para esse grupo, as ações de administrador não aparecem, e cada tela afetada mostra um aviso explicando que só administradores cadastram, alteram ou analisam.

**Empresas terceirizadas:** empresas contratadas para uma ou mais obras, com um acesso ao portal por CNPJ. Recebem o convite por e-mail, fazem o primeiro acesso com a senha provisória, criam a própria senha e enviam os documentos exigidos. Precisam de uma interface simples, que funcione no celular, com a situação de cada documento em texto, orientações claras sobre formato e tamanho aceitos e o motivo de cada rejeição.

**TI da Jotanunes e responsável pela instalação:** responsáveis por integrar a área Jotanunes ao Fluig (configurar a abertura do sistema com o token de identidade assinado e o grupo de administradores) e por instalar e operar o sistema no servidor. Na instalação, criam o primeiro administrador interno por um comando de linha no servidor, que envia o e-mail de acesso e mostra a senha provisória apenas no terminal.

**Jotanunes Construtora (organização contratante):** propôs o desafio e tem interesse em uma solução funcional, segura e alinhada ao seu processo e à sua identidade visual. Define quais documentos são exigidos, valida as decisões de negócio registradas na especificação e responde pelo tratamento dos dados perante a LGPD.

**Trabalhadores das empresas terceirizadas:** envolvidos de forma indireta, pois alguns documentos (por exemplo, programas de saúde ocupacional e de gerenciamento de riscos) tratam das condições de trabalho e podem conter dados pessoais. Mesmo sem acessar o sistema, seus dados devem ser protegidos contra acesso ou exposição indevidos.

## 2.3. Regras de Negócio

As regras de negócio definem as condições e restrições que orientam o funcionamento do sistema. Para o Portal de Documentação de Terceirizadas Jotanunes, foram estabelecidas as seguintes regras:

RN01 — Documentos exigidos por empresa

Os documentos são exigidos por empresa, e não por obra. Um envio aprovado vale para todas as obras em que a empresa atua; o vínculo entre obra e empresa serve para a Jotanunes organizar e filtrar.

RN02 — Mesmos tipos de documento para todas as empresas

Todos os tipos de documento ativos do catálogo são exigidos de todas as empresas ativas, sem seleção por empresa. Um tipo criado depois passa a aparecer como "Pendente de envio" para todas as empresas ativas; um tipo desativado deixa de ser exigido, mas os envios já feitos continuam no histórico.

RN03 — Identificação única da empresa pelo CNPJ

Cada empresa é identificada de forma única pelo CNPJ, validado pelos dígitos verificadores nos formatos numérico e alfanumérico da Receita Federal e armazenado sem máscara. CNPJ com ou sem máscara é tratado como o mesmo; CNPJ repetido é recusado. O CNPJ não pode ser alterado depois do primeiro convite.

RN04 — Convite com senha provisória

O acesso da empresa ao portal começa pelo convite enviado ao e-mail de contato. A cada convite, o sistema gera uma senha provisória aleatória de 12 caracteres, enviada no mesmo e-mail do link. O link é único, imprevisível e vale 7 dias. A senha provisória nunca é exibida na área Jotanunes.

RN05 — Reenvio do convite

O convite pode ser reenviado a qualquer momento, por qualquer usuário da Jotanunes. O reenvio invalida o link e a senha anteriores e obriga a empresa a trocar a senha no próximo acesso. Na primeira versão, o reenvio também é o caminho para a empresa que esqueceu a senha.

RN06 — Troca obrigatória de senha no primeiro acesso

Quem entra com senha provisória (empresa ou usuário interno) é obrigado a criar uma nova senha antes de acessar qualquer outra função. A nova senha deve ter de 8 a 128 caracteres, pelo menos uma letra e um número, e ser diferente da atual.

RN07 — Expiração da senha provisória

A senha provisória que não for usada em 7 dias deixa de valer. A empresa precisa pedir um novo convite; o usuário interno precisa pedir a um administrador que gere outra senha.

RN08 — Bloqueio por tentativas

Depois de 5 tentativas seguidas de senha errada para o mesmo CNPJ ou login, o acesso fica bloqueado por 15 minutos. A regra vale também para CNPJ ou login inexistente, com as mesmas mensagens e a mesma sequência de respostas, para não revelar quem está cadastrado.

RN09 — Isolamento entre empresas

Uma empresa nunca pode listar, ver, baixar ou enviar documentos de outra. Qualquer tentativa é respondida como se o recurso não existisse, sem expor nenhum dado da outra empresa.

RN10 — Separação das credenciais

A credencial do portal não é aceita na área Jotanunes, e as identidades da área Jotanunes (Fluig ou login próprio) não são aceitas no portal. Um token de uma origem adulterado para parecer de outra é recusado.

RN11 — Formatos e tamanho dos arquivos

São aceitos somente arquivos PDF, JPEG ou PNG, com no máximo 10 MB e um arquivo por envio. O formato é conferido pelo conteúdo real do arquivo, e não apenas pela extensão; arquivos vazios, corrompidos ou com extensão trocada são recusados.

RN12 — Envio único ativo por documento

A empresa só pode enviar arquivo para documento "Pendente de envio" ou "Rejeitado". Documento "Em análise" ou "Aprovado" não aceita novo arquivo. Se dois envios para o mesmo documento chegarem ao mesmo tempo, só o primeiro é aceito.

RN13 — Análise com motivo na rejeição

Somente envios "Em análise" podem ser analisados. Aprovar registra quem aprovou e quando; rejeitar exige motivo de 5 a 500 caracteres e registra quem rejeitou, quando e o motivo. Ao rejeitar, a empresa recebe um e-mail com o documento e o motivo.

RN14 — Decisão definitiva

A decisão de análise é definitiva e não pode ser editada. Um envio já analisado não pode ser analisado de novo; se duas pessoas decidirem ao mesmo tempo, a segunda decisão é recusada. A Jotanunes não reabre documento aprovado na primeira versão.

RN15 — Privacidade dos analistas perante a empresa

No histórico exibido à empresa aparecem a situação, as datas e o motivo da rejeição, mas não quem analisou. Os dados dos colaboradores da Jotanunes ficam visíveis apenas na área Jotanunes.

RN16 — Perfis de acesso da área Jotanunes

Há dois perfis: administrador e usuário comum. Somente o administrador cadastra, edita, ativa e desativa obras, empresas e tipos de documento, vincula e desvincula empresas das obras, aprova e rejeita envios e gerencia usuários internos. Os dois perfis consultam tudo e podem enviar e reenviar convites. A permissão é verificada no servidor antes de qualquer validação ou efeito.

RN17 — Origem do perfil

Na entrada pelo Fluig, o perfil vem do papel informado no token de identidade e vale até o token expirar (no máximo 8 horas); sem o papel, o usuário é comum. No login próprio, o perfil vem do cadastro do usuário interno e a mudança vale na hora.

RN18 — Revogação imediata das sessões do usuário interno

As sessões de um usuário interno deixam de valer na próxima requisição quando ele é desativado, tem a senha redefinida ou trocada, tem o papel de administrador dado ou retirado ou clica em "Sair". Mudar apenas nome ou e-mail não derruba sessões.

RN19 — Login único e imutável do usuário interno

O login do usuário interno é único sem diferenciar maiúsculas, tem de 3 a 100 caracteres (letras sem acento, números, ponto, hífen e sublinhado) e não pode ser alterado depois do cadastro.

RN20 — Último administrador

O sistema mantém sempre pelo menos um usuário interno administrador ativo: é recusado desativar ou tirar o papel do último administrador interno ativo. Além disso, ninguém pode desativar a si mesmo nem tirar o próprio papel de administrador.

RN21 — Primeiro administrador na instalação

Numa instalação nova, o primeiro administrador interno é criado por um comando executado no servidor pelo responsável pela instalação. O comando recusa a criação se já houver administrador ativo, salvo com a opção de forçar, usada para recuperação.

RN22 — Catálogo padrão de tipos de documento

Quando o catálogo de tipos de documento está vazio, o sistema cria automaticamente, ao iniciar, os 10 tipos padrão, ativos e com instruções. Se existir qualquer tipo (ativo ou inativo), nada é criado nem alterado, e reinícios simultâneos não duplicam tipos. A criação fica registrada como feita pelo sistema.

RN23 — Nada é excluído pela interface

Obras, empresas, tipos de documento e usuários internos não são apagados, e sim desativados, preservando o histórico. A única remoção permitida é a do vínculo entre obra e empresa.

RN24 — Empresa desativada

Uma empresa desativada perde o acesso ao portal na hora, deixa de ter documentos exigidos e não pode receber convite. Ao ser reativada, volta a acessar com a senha que já tinha.

RN25 — Trilha de auditoria

São registrados em auditoria: login (sucesso, falha e bloqueio), troca de senha, saída, envio de convite, envio de documento, download de arquivo, decisão de análise, gestão de usuários internos e tentativas negadas por falta de permissão, com quem fez, quando, qual recurso, a origem da identidade e se o usuário era administrador. Senhas, tokens e conteúdo de arquivos nunca são gravados.

RN26 — Arquivos nunca públicos

Os arquivos enviados só podem ser obtidos por usuários autenticados e autorizados: a própria empresa, para os seus arquivos, e os usuários da Jotanunes. Não existe endereço público ou permanente para um arquivo.

RN27 — Sessões com prazo

A sessão da empresa no portal e a sessão do login próprio duram no máximo 8 horas, sem opção "lembrar de mim". A identidade do Fluig vale pelo tempo definido pelo Fluig, também limitado a 8 horas.
