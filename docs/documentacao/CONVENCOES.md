# Convenções da documentação (modelo "Documentação de um Produto de Software – Versão 3.0")

Objetivo: produzir um documento **com a mesma estrutura** do modelo `Modelo de documento R.D.pdf`
(roteiro da Profa. Ana Paula Gonçalves Serra, USJT), preenchido com o **sistema Portal de Documentação de
Terceirizadas Jotanunes** deste repositório. Saída final: `docs/documentacao/Documentacao-Portal-Documentos-Jotanunes.docx` e `.pdf`.

## Onde está o modelo
- Texto completo do modelo (layout preservado): `/private/tmp/claude-501/-Users-gabrielalmeidasantosmelo-projetos-residencia/dcc99a35-5a03-4a9a-a23f-82377d454e7a/scratchpad/modelo/modelo.txt`
- Imagens das 42 páginas (50 dpi): `.../scratchpad/modelo/p-01.png` … `p-42.png` (e folhas-resumo `sheet1..4.png`).
- Original: `~/Downloads/Modelo de documento R.D.pdf` (não alterar).

## Estrutura (seguir a numeração e os títulos do modelo)
Capa · Índice detalhado · Prefácio · "Modelo da Documentação" ·
1 Introdução ao Documento (1.1 Tema, 1.2 Objetivo do Projeto, 1.3 Delimitação do Problema, 1.4 Justificativa da Escolha do Tema, 1.5 Método de Trabalho, 1.6 Organização do Trabalho, 1.7 Glossário [tabela Termo | Definição]) ·
2 Descrição Geral do Sistema (2.1 Descrição do Problema, 2.2 Principais Envolvidos e suas Características, 2.3 Regras de Negócio [RN01…]) ·
3 Requisitos do Sistema (3.1 Requisitos Funcionais [RF01…], 3.2 Requisitos Não-Funcionais, 3.3 Protótipo [objetivo, fluxo geral, uma subseção por tela com os bullets Objetivo da tela / De onde é chamada / Pode chamar / Usuários / Domínio / Regras / Lógica de negócio, requisitos de usabilidade, regras de acesso e segurança, evolução incremental, resumo das telas, 3.3.1 Diagrama de Navegação com sequência, fluxo principal, fluxos alternativos/exceções e representação simplificada], 3.4 Métricas e Cronograma [técnica de estimativa, Pontos de Caso de Uso com as tabelas UAW/UUCW/TCF/ECF/UCP, recursos, cronograma, distribuição por área, considerações]) ·
4 Análise e Design (4.1 Arquitetura, 4.2 Modelo do Domínio, 4.3 Diagramas de Interação/4.3.1 Sequência, 4.4 Classes, 4.5 Atividades, 4.6 Estados, 4.7 Componentes, 4.8 Modelo de Dados: 4.8.1 Lógico, 4.8.2 Criação Física, 4.8.3 Dicionário de Dados, 4.9 Ambiente de Desenvolvimento, 4.10 Sistemas e Componentes Externos) — use a numeração do ÍNDICE do modelo (que tem 4.6 Estados e 4.8 Modelo de Dados) ·
5 Implementação · 6 Testes (6.1 Plano, 6.2 Execução) · 7 Implantação (7.1 Diagrama, 7.2 Manual) · 8 Manual do Usuário · 9 Conclusões e Considerações Finais · Bibliografia.

Tom: impessoal, objetivo, português do Brasil, como no modelo. Onde o modelo traz texto-instrução ("Neste item deve-se…"), o nosso documento traz o CONTEÚDO real do sistema (pode manter uma frase introdutória curta de cada capítulo, como o modelo faz).

## Autoria e fatos do projeto
- Autor (capa e rodapé): **Squad 81 — Residência de Software**. Organização contratante: **Jotanunes Construtora**.
- Sistema: Portal de Documentação de Terceirizadas Jotanunes (área Jotanunes/"fluig-app" + portal da terceirizada + API).
- Fontes de verdade (ler): `docs/transcricao.txt` (requisitos do cliente), `docs/design.md`, `specs/001-portal-documentos-terceirizadas/{spec.md,plan.md,research.md,data-model.md,quickstart.md,tasks.md,contracts/openapi.yaml,contracts/fluig-identity.md}`, `.specify/memory/constitution.md`, `README.md`, `backend/README.md`, `deploy/README.md`, código em `backend/`, `fluig-app/`, `portal/`.
- Histórico real (para cronograma): `docs/documentacao/historico-commits.txt` (datas dos commits). Processo: Spec Kit (constitution → specify → clarify → plan → tasks → analyze → implement → converge) com agentes de IA em paralelo por área (backend, fluig-app, portal) e revisão/integração/E2E pelo orquestrador.
- Testes (números atuais): backend 467 (Domain 104, Application 42, Api 321, xUnit + Testcontainers/Postgres); fluig-app 190 (Vitest); portal 71 (Vitest); roteiro E2E manual do quickstart (56 passos) executado.
- Produção: VPS Ubuntu 24.04 (CloudPanel) 177.7.52.155; nginx + Certbot; API systemd `jotanunes-docs-api` em 127.0.0.1:5080; PostgreSQL 16 local; fronts estáticos. URLs: https://protal.jotanunes.squad81.metapark.site (portal), https://fluig.jotanunes.squad81.metapark.site (área Jotanunes), https://api.jotanunes.squad81.metapark.site (API). E-mail via Resend (remetente nao-responda@metapark.site).
- **Nunca** colocar senhas, tokens, segredos, IP de acesso SSH com usuário, ou dados pessoais reais no documento (e-mails de exemplo: use @exemplo.com.br).

## Formato de entrega do conteúdo (para o montador)
Cada capítulo em `docs/documentacao/conteudo/NN-nome.md` (NN = 01…09, 10-bibliografia), em Markdown restrito:
- `#` = título de capítulo (ex.: `# 1. Introdução ao Documento`), `##` = seção (`## 1.1. Tema`), `###` = subseção (`### 4.8.1. Modelo Lógico da Base de Dados`), `####` = subtítulo sem numeração no índice (ex.: "Tela 1 – Login").
- Parágrafos simples; **negrito** e *itálico* permitidos; listas com `- `; listas numeradas com `1. `.
- Tabelas em pipe-table Markdown (primeira linha = cabeçalho).
- Imagens: `![Legenda da figura](../diagramas/arquivo.png)` ou `(../telas/arquivo.png)` — a legenda vira "Figura N – Legenda".
- Blocos de código (DDL, comandos) em cercas ``` com linguagem.
- Nota de rodapé: `[^1]` com a definição `[^1]: texto` no fim do arquivo.
- Não use HTML.
