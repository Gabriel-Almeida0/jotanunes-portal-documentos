# 9. Conclusões e Considerações Finais

Este capítulo apresenta a aplicabilidade dos resultados obtidos, as limitações do sistema, seus aspectos inovadores, as possíveis integrações e a continuação do trabalho.

## Resultados obtidos

O Portal de Documentação de Terceirizadas Jotanunes atende ao problema levantado com o cliente: substituir o controle manual, com arquivos chegando por canais diferentes e acompanhamento em controles paralelos, dos documentos exigidos das empresas prestadoras de serviço nas obras da Jotanunes Construtora por um fluxo único, rastreável e seguro. O sistema entregue permite:

- cadastrar obras, empresas terceirizadas e os tipos de documento exigidos, com um catálogo padrão de 10 documentos já disponível na instalação;
- convidar as empresas por e-mail, com senha temporária e troca obrigatória no primeiro acesso;
- receber os documentos pelo portal, com validação real do formato e do tamanho dos arquivos;
- analisar os envios em uma fila única, aprovando ou rejeitando com motivo, e avisar a empresa por e-mail em caso de rejeição;
- acompanhar, por obra e por empresa, a situação de cada documento e o histórico completo dos envios;
- controlar quem pode alterar e analisar (perfis administrador e comum) e registrar todas as ações relevantes em trilha de auditoria.

O sistema está em produção nos endereços apresentados no capítulo 7, com 728 testes automatizados aprovados (467 no backend, 190 na área Jotanunes e 71 no portal) e um roteiro manual de 56 passos executado de ponta a ponta.

## Aplicabilidade

A solução pode ser usada imediatamente pela Jotanunes com o login próprio da área Jotanunes, sem depender de nenhuma configuração adicional no Fluig. A arquitetura hexagonal e o contrato OpenAPI tornam o sistema fácil de evoluir: trocar o armazenamento local por um serviço de objetos, o provedor de e-mail ou a forma de autenticação exige apenas um novo adaptador, sem alterar as regras de negócio. O mesmo fluxo de convite, envio e análise pode ser aproveitado para outros tipos de parceiros que precisem comprovar documentação, como fornecedores.

## Inovação

Merecem destaque:

- o **processo de desenvolvimento orientado por especificação** (GitHub Spec Kit), em que constituição, especificação, clarificações, plano, modelo de dados, contrato e 176 tarefas foram escritos antes do código e mantidos coerentes por etapas de análise e convergência;
- o uso de **agentes de IA trabalhando em paralelo** por área (backend, área Jotanunes e portal), orquestrados e revisados, com integração e testes E2E ao final de cada fase — o que permitiu entregar em pouco tempo um sistema com cobertura ampla de testes;
- o **contrato OpenAPI como fonte de verdade**, verificado automaticamente contra a API e usado para gerar os tipos dos fronts e os mocks dos testes;
- o suporte ao **CNPJ alfanumérico**, antecipando a mudança de formato prevista pela Receita Federal;
- a **segurança por padrão**: revogação imediata de sessões pela versão da credencial, proteção contra descoberta de CNPJs e logins cadastrados, identificação do tipo de arquivo pelo conteúdo e auditoria completa, alinhadas à LGPD e ao OWASP ASVS.

## Limitações

- A integração com o Fluig está especificada e testada com tokens de teste no mesmo formato, mas a configuração do lado do Fluig (geração do token e abertura da área Jotanunes) ainda precisa ser feita pela equipe de TI da Jotanunes.
- O sistema não controla a **validade (vencimento)** dos documentos: a orientação "dentro da validade" é apenas textual.
- Todos os tipos de documento ativos são exigidos de todas as empresas; não há exigência diferenciada por obra, por tipo de serviço ou por empresa.
- Os arquivos ficam no disco do próprio servidor, o que exige rotina de cópia de segurança junto com o banco de dados.
- A empresa terceirizada tem um único acesso por CNPJ; não há vários usuários por empresa.
- Não há notificações automáticas de lembrete (por exemplo, documentos pendentes há muitos dias) nem relatórios exportáveis.

## Trabalhos futuros

Como continuação do projeto, sugerem-se:

1. concluir a integração com o Fluig em produção e, se desejado, desligar o login próprio;
2. controlar a data de validade dos documentos, com alertas de vencimento para a Jotanunes e para a empresa;
3. permitir exigências por obra ou por tipo de serviço, e vários usuários por empresa terceirizada;
4. migrar o armazenamento de arquivos para um serviço de objetos com cópia de segurança automática;
5. criar relatórios e exportação (por obra, por empresa e por período) e lembretes automáticos por e-mail;
6. integrar a situação documental das terceirizadas a processos do Fluig, como a liberação de acesso à obra ou de pagamentos.

## Considerações finais

O projeto mostrou que um processo disciplinado — especificar, clarificar, planejar, dividir em tarefas, implementar com testes e verificar a coerência entre os artefatos — combinado a agentes de IA orquestrados e à revisão humana, produz software de qualidade em prazo curto, com documentação e rastreabilidade entre requisitos, código e testes. O sistema entregue resolve o problema do cliente, está em funcionamento e está preparado para evoluir com as próximas necessidades da Jotanunes.
