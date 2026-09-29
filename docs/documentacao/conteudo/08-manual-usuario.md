# 8. Manual do Usuário

Este capítulo descreve, passo a passo, como utilizar o sistema. O manual está dividido pelos três tipos de usuário: o **administrador da Jotanunes**, o **usuário comum da Jotanunes** e a **empresa terceirizada**. Os dois primeiros usam a área Jotanunes (https://fluig.jotanunes.squad81.metapark.site); a terceirizada usa o portal (https://protal.jotanunes.squad81.metapark.site). Basta um navegador atualizado; nenhuma instalação é necessária.

## 8.1. Acesso à Área Jotanunes

A área Jotanunes pode ser aberta de duas formas:

1. **Pelo Fluig**: ao abrir o sistema a partir do Fluig, a pessoa entra direto no Painel, sem digitar senha. O perfil (administrador ou comum) vem do Fluig. Nessa forma de acesso não aparecem as opções "Trocar senha" e "Sair", porque a sessão é controlada pelo Fluig.
2. **Com login próprio**: ao abrir o endereço diretamente, aparece a tela de login. Informe o **login** e a **senha** e clique em **Acessar**. No primeiro acesso, use a senha provisória recebida por e-mail; o sistema pede então que você crie a sua senha (informe a senha atual, a nova senha e a confirmação). A nova senha precisa ter pelo menos 8 caracteres, com letras e números.

![Área Jotanunes – tela de login próprio](../telas/fluig-01-login.png)

Observações sobre o acesso:

- Login inexistente ou senha errada mostram a mesma mensagem, "Login ou senha incorretos.". Após 5 tentativas erradas seguidas, o acesso fica bloqueado por 15 minutos, e o horário de liberação é informado.
- A senha provisória vale por 7 dias. Se ela vencer, peça a um administrador para **redefinir a senha**.
- Se o login próprio estiver desligado, a tela mostra "Abra este sistema pelo Fluig.".
- Para trocar a senha a qualquer momento, use **Trocar senha** no menu lateral; para encerrar a sessão, use **Sair**.

## 8.2. Administrador da Jotanunes

O administrador tem acesso a todas as telas e ações: cadastros, convites, análise de documentos e gestão de usuários.

#### Acompanhar o painel

1. Após entrar, o **Painel** mostra os indicadores: documentos aguardando análise, empresas com pendência (documento pendente ou rejeitado), empresas convidadas que ainda não acessaram o portal, empresas ativas e obras ativas.
2. Use os atalhos de cada indicador ("Abrir fila de análise", "Ver empresas com pendência", "Convidadas", "Convite expirado", "Ver empresas", "Ver obras") para ir direto à fila ou à lista filtrada.

![Painel da área Jotanunes](../telas/fluig-03-painel.png)

#### Cadastrar uma obra e vincular empresas

1. No menu lateral, clique em **Obras** e depois em **Nova obra**.
2. Preencha o **Nome da obra**, a **Cidade**, a **UF** e, se houver, o **Código** interno; clique em **Salvar**.
3. Na lista, clique no nome da obra para abrir o detalhe.
4. Clique em **Vincular empresa**, busque a empresa pelo nome ou CNPJ e selecione-a. A empresa precisa estar cadastrada antes (ver próximo item).
5. No detalhe da obra, cada empresa vinculada mostra a situação de acesso ao portal e o andamento dos documentos ("2 de 10 aprovados", por exemplo). Para remover um vínculo, clique em **Desvincular** e confirme; os documentos da empresa não são afetados.
6. Para alterar os dados ou desativar a obra, use **Editar dados** ou **Desativar obra**.

![Detalhe da obra com as empresas vinculadas](../telas/fluig-05-obra-detalhe.png)

#### Cadastrar uma empresa terceirizada e enviar o convite

1. No menu, clique em **Empresas** e em **Nova empresa**.
2. Informe a **Razão social**, o **CNPJ** (aceita o formato numérico e o novo formato alfanumérico), o **E-mail de contato** (para onde vai o convite) e, opcionalmente, nome fantasia, nome do contato e telefone. Clique em **Salvar**.
3. No detalhe da empresa, no quadro **Acesso ao portal**, clique em **Enviar convite** e confirme. A empresa recebe um e-mail com o link do portal e uma senha temporária válida por 7 dias. A senha não aparece na tela.
4. A situação de acesso passa de "Não convidada" para "Convidada" e, após o primeiro acesso da empresa, para "Acesso ativo". Se o convite vencer ("Convite expirado") ou a empresa esquecer a senha, clique em **Reenviar convite**: o convite anterior deixa de valer e a sessão aberta da empresa é encerrada.
5. Depois do primeiro convite, o CNPJ não pode mais ser alterado.
6. A lista de empresas pode ser filtrada por obra, situação de acesso e pendência de documentos.

![Detalhe da empresa: dados, acesso ao portal, obras e situação dos documentos](../telas/fluig-07-empresa-detalhe.png)

#### Manter os tipos de documento

1. No menu, clique em **Tipos de documento**. O sistema já vem com 10 tipos padrão (Cartão CNPJ, Contrato Social, CND Federal, CND Estadual, CND Municipal, CRF do FGTS, CNDT, PGR, PCMSO e ART/RRT).
2. Para criar um tipo, clique em **Novo tipo de documento**, informe o **Nome** e as **Instruções para a empresa** (texto que a terceirizada vê ao enviar) e salve.
3. Todo tipo ativo passa a ser exigido de **todas** as empresas ativas. Para deixar de exigir um documento, desative o tipo; o histórico dos envios é preservado.

#### Analisar os documentos enviados

1. No menu, clique em **Fila de análise**. Os envios aparecem do mais antigo para o mais recente e podem ser filtrados por obra, empresa e documento.
2. Clique em **Analisar** no envio desejado.
3. Na tela do envio, use **Abrir arquivo** ou **Baixar** para conferir o documento. O quadro "O que a empresa precisava enviar" mostra as instruções do tipo.
4. Se o documento estiver correto, clique em **Aprovar** e confirme.
5. Se não estiver, clique em **Rejeitar**, escreva o **Motivo da rejeição** (de 5 a 500 caracteres, explicando o que corrigir) e confirme. A empresa recebe um e-mail com o motivo e pode enviar um novo arquivo.
6. Se outra pessoa já tiver analisado o mesmo envio, o sistema avisa "Este envio já foi analisado." e nada é alterado.

![Análise de um envio](../telas/fluig-10-analise-envio.png)

#### Gerenciar os usuários do login próprio

1. No menu, clique em **Usuários** (item visível só para administradores).
2. Para cadastrar, clique em **Novo usuário**, informe **Login** (letras sem acento, números, ponto, hífen ou sublinhado; não pode ser alterado depois), **Nome**, **E-mail** e **Perfil** (administrador ou comum). A pessoa recebe por e-mail a senha provisória, válida por 7 dias.
3. Use **Editar** para alterar nome, e-mail ou perfil; **Redefinir senha** para enviar uma nova senha provisória; **Desativar** para bloquear o acesso. Qualquer uma dessas mudanças de perfil, situação ou senha encerra na hora as sessões abertas daquela pessoa.
4. O sistema não permite que você desative a si mesmo ou retire o seu próprio perfil de administrador, nem que o último administrador ativo deixe de sê-lo.

![Gestão de usuários do login próprio](../telas/fluig-11-usuarios.png)

## 8.3. Usuário Comum da Jotanunes

O usuário comum consulta todas as informações, mas não cadastra, não altera e não analisa.

1. Entre pelo Fluig ou com o login próprio, como descrito no início do capítulo.
2. Consulte o **Painel**, as **Obras**, as **Empresas**, os **Tipos de documento** e a **Fila de análise** normalmente. Nas telas aparece o aviso "Só administradores podem cadastrar, alterar ou analisar. Se você precisa, fale com a TI." e os botões de criar, editar, ativar, desativar, vincular, aprovar e rejeitar não são exibidos.
3. No detalhe da empresa, é possível **Enviar convite** ou **Reenviar convite** (ação liberada também para o perfil comum) e consultar a situação e o histórico de cada documento.
4. Na fila de análise, é possível abrir o envio e o arquivo para consulta, sem as opções de aprovar ou rejeitar.
5. Se precisar de uma ação de administrador, peça a um administrador ou à TI a mudança de perfil.

## 8.4. Empresa Terceirizada

A empresa terceirizada usa o portal para enviar os documentos exigidos pela Jotanunes e acompanhar a análise.

#### Primeiro acesso

1. Abra o e-mail de convite enviado pela Jotanunes e clique no link. O portal abre com o CNPJ da empresa já preenchido.
2. Digite a **senha temporária** que veio no e-mail e clique em **Acessar**.
3. Na tela "Crie uma nova senha para continuar.", informe a senha atual (a temporária), a nova senha (pelo menos 8 caracteres, com letras e números) e a confirmação, e clique em **Salvar e continuar**.
4. Nos próximos acessos, entre pelo endereço do portal com o **CNPJ** e a **senha criada**.

![Portal – acesso com CNPJ e senha](../telas/portal-01-login.png)

Se esquecer a senha ou se o convite vencer (7 dias), peça à Jotanunes um novo convite: ele chega no e-mail da empresa com uma nova senha temporária. Após 5 senhas erradas seguidas, o acesso fica bloqueado por 15 minutos.

#### Enviar os documentos

1. A tela **Meus documentos** lista todos os documentos exigidos, com o resumo no topo (rejeitados, pendentes de envio, em análise e aprovados). Os rejeitados e pendentes aparecem primeiro.
2. Em cada documento, leia as instruções e clique em **Enviar documento**. Escolha um arquivo **PDF, JPG ou PNG com até 10 MB**.
3. Após o envio, o documento passa para "Em análise" e mostra o nome do arquivo e a data. Enquanto estiver em análise ou aprovado, não é possível enviar outro arquivo para ele.
4. Se o arquivo for recusado pelo sistema (formato não aceito, arquivo corrompido ou maior que 10 MB), uma mensagem explica o motivo; corrija e envie de novo.
5. Se a Jotanunes rejeitar o documento, a empresa recebe um e-mail e o cartão do documento mostra o **Motivo** da rejeição. Corrija e clique em **Enviar novo arquivo**.
6. Clique no nome de um arquivo para baixá-lo.

![Portal – Meus documentos](../telas/portal-03-meus-documentos.png)

#### Consultar o histórico

1. Em um documento já enviado, clique em **Ver histórico de envios**.
2. A tela mostra todos os envios daquele documento, do mais recente para o mais antigo, com data, situação e, nos rejeitados, o motivo.
3. Clique em **Meus documentos** para voltar. Para encerrar, clique em **Sair**, no canto superior direito.
