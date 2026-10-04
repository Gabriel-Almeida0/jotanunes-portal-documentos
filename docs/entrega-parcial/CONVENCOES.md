# Entrega Parcial – LevelUp (Residência em Software & IA) — convenções

Modelo a preencher: `~/Downloads/1. ENTREGA_PARCIAL_RIV_LEVELUP_2026.1 (1).docx` (NÃO alterar o original).
Saída final: `docs/entrega-parcial/ENTREGA_PARCIAL_RIV_LEVELUP_2026.1_Squad81.docx` (+ PDF).
Empresa: Jotanunes Construtora · Squad: 81.

Estrutura do modelo (manter títulos e instruções; o conteúdo entra DEPOIS de cada item):
1. DESCRIÇÃO DO PROBLEMA E PERSONAS "IA-Augmented"
   1.1 Problema (≤ 250 caracteres) · Solução (≤ 250 caracteres) · Onde a IA gera valor (automação, predição ou geração) · Personas
   1.2 Cenários de Uso e Casos de Borda (Edge Cases) de IA — cenários de falha, casos críticos de erro
   1.3 Entrevistas e Validação de Hipóteses (OPCIONAL) — com humanos e com agentes inteligentes: pontos de dor, validação do problema
2. BACKLOG E ENGENHARIA DE REQUISITOS "AI-FIRST"
   2.1 Backlog priorizado e categorizado: épicos; histórias; detalhamento das tarefas; padrões de uso de ferramentas de IA no projeto
   2.2 Histórias de usuário e critérios de aceite de IA — critérios de aceite e como garantir que o resultado das ferramentas de IA está correto
3. BANCO DE DADOS E API
   3.1 Estrutura do BD (entidades, atributos, relacionamentos, PK/FK) + quais estruturas se relacionam a IA (se fizer sentido)
   3.2 Design da API: principais endpoints com métodos HTTP; estrutura de requisições e respostas
   3.3 Fluxo de dados e lógica: entrada, processamento clássico, integração com IA (se houver), indexação/recuperação para IA (se houver), persistência, retorno ao frontend, exemplo de fluxo completo
   3.4 Tratamento de exceções e falhas: validação/formato/ausentes; falhas de integração externa (conexão, timeout, respostas inesperadas); falhas de IA (se houver); limites de requisição, latência, indisponibilidade
4. ARQUITETURA DE SOFTWARE E STACK
   4.1 Stack de desenvolvimento e IA (ferramentas de IA pagas × gratuitas)
   4.2 Estrutura de pastas e arquitetura; integração do frontend com APIs de IA (se houver); latência, erros, timeout, indisponibilidade
5. RELATO DO PROCESSO E ENGENHARIA DE PROMPT (OPCIONAL) — escrito pelo orquestrador

## Verdade sobre IA (OBRIGATÓRIO respeitar)
- O PRODUTO (API + área Jotanunes + portal) NÃO usa IA em produção: não há chamada a LLM, OCR, modelo preditivo etc.
- A IA foi usada no PROCESSO: transcrição local do áudio de requisitos (faster-whisper, modelo "medium", gratuito, local); especificação e implementação com GitHub Spec Kit + Claude Code (agentes de IA em paralelo por área: backend, fluig-app, portal; orquestrador revisando, integrando e testando); análise de consistência (speckit-analyze) e de lacunas (speckit-converge); geração de diagramas (Mermaid), testes automatizados e E2E com Playwright conduzidos por agentes; documentação gerada com agentes.
- Onde o modelo pede "IA na solução", escreva com honestidade: (a) valor da IA hoje está no processo de construção; (b) OPORTUNIDADES de IA no produto como PROPOSTA para próxima iteração (ex.: extrair automaticamente a data de validade/emissor das certidões e alertar vencimento; verificar se o arquivo enviado corresponde ao tipo de documento; pré-triagem/resumo para o analista; detecção de documento ilegível) — marcando claramente "proposta, não implementado". Para itens "(caso estejam utilizando)" de IA, diga "não se aplica na versão atual" e, se útil, descreva como seria tratado na proposta.

## Fontes de verdade
`docs/transcricao.txt` (entrevista com o cliente), `docs/design.md`, `specs/001-portal-documentos-terceirizadas/*` (spec.md com US1–US10, FR, SC, Clarifications; plan.md; research.md; data-model.md; tasks.md com T001–T176; contracts/openapi.yaml 1.2.0; quickstart.md), `.specify/memory/constitution.md`, `docs/documentacao/conteudo/*.md` (documentação completa já escrita — REUTILIZE), `docs/documentacao/diagramas/*.png` (diagramas prontos: modelo-logico, arquitetura, sequencias, componentes etc.), código em `backend/`, `fluig-app/`, `portal/`, `deploy/`.
Testes atuais: backend 467, fluig-app 190, portal 71 (todos verdes); E2E manual do quickstart executado.
Produção: https://protal.jotanunes.squad81.metapark.site · https://fluig.jotanunes.squad81.metapark.site · https://api.jotanunes.squad81.metapark.site.
Nunca coloque senhas, tokens, segredos, IP com usuário, nem e-mails reais (use @exemplo.com.br).

## Formato de entrega do conteúdo
Arquivos Markdown restrito em `docs/entrega-parcial/conteudo/` — um bloco por item do modelo, com o cabeçalho de âncora EXATO abaixo (o montador insere o conteúdo logo após o item correspondente do modelo):
`<!-- ANCORA: 1.1 -->`, `<!-- ANCORA: 1.2 -->`, `<!-- ANCORA: 1.3 -->`, `<!-- ANCORA: 2.1 -->`, `<!-- ANCORA: 2.2 -->`, `<!-- ANCORA: 3.1 -->`, `<!-- ANCORA: 3.2 -->`, `<!-- ANCORA: 3.3 -->`, `<!-- ANCORA: 3.4 -->`, `<!-- ANCORA: 4.1 -->`, `<!-- ANCORA: 4.2 -->`, `<!-- ANCORA: 5.1 -->`, `<!-- ANCORA: 5.2 -->`.
Dentro: parágrafos, **negrito**/*itálico*, listas `- `, listas numeradas `1. `, `####` subtítulo (ex.: "Problema", "Personas"), tabelas pipe-table, imagens `![legenda](../../documentacao/diagramas/arquivo.png)`, código em ``` (curto). Seja objetivo: o modelo tem 4 páginas de roteiro; o preenchido deve ficar entre ~15 e ~25 páginas no total.
