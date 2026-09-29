# 5. Implementação

Este capítulo descreve como as classes e componentes definidos no capítulo 4 foram implementados. A implementação seguiu as decisões registradas na constituição do projeto (`.specify/memory/constitution.md`), no plano técnico e no contrato OpenAPI, e foi conduzida pelo processo do GitHub Spec Kit: cada funcionalidade foi especificada, clarificada, planejada e quebrada em tarefas numeradas (T001 a T176) antes de ser codificada, com testes escritos junto com o código.

## Organização do código

**Backend (arquitetura hexagonal).** A solução `backend/Jotanunes.Docs.sln` tem quatro projetos de produção, com dependências que apontam sempre para o núcleo:

| Projeto | Conteúdo | Pode depender de |
|---|---|---|
| `Jotanunes.Docs.Domain` | Entidades (`Obra`, `Empresa`, `Convite`, `TipoDocumento`, `EnvioDocumento`, `UsuarioInterno`), objetos de valor (`Cnpj`, `Email`, `Uf`, `LoginUsuario`), regras (`RegraSituacaoDocumento`, `PoliticaSenha`) e erros de domínio | nenhum outro projeto |
| `Jotanunes.Docs.Application` | Casos de uso (uma classe por operação), portas (interfaces de persistência, e-mail, armazenamento, hash, tokens, auditoria), DTOs, modelos de e-mail e catálogo de erros | `Domain` |
| `Jotanunes.Docs.Infrastructure` | Adaptadores de saída: `DocsDbContext` e repositórios (EF Core/Npgsql), *migrations*, armazenamento em disco, detector de formato de arquivo, envio pelo Resend, BCrypt, emissão de tokens JWT, auditoria e trava exclusiva no PostgreSQL | `Application`, `Domain` |
| `Jotanunes.Docs.Api` | Adaptador de entrada: *endpoints* (Minimal APIs) agrupados em `/api/fluig` e `/api/portal`, esquemas de autenticação e políticas de autorização, *middlewares* de erro e de cabeçalhos de segurança, limite de requisições, validação da configuração e o comando `criar-admin` | todos |

A regra de dependência é verificada por um teste de arquitetura (`ArquiteturaTests`): o `Domain` não pode referenciar camadas externas e a `Application` não pode referenciar a infraestrutura. Os casos de uso implementam a interface marcadora `ICasoDeUso` e são registrados automaticamente no contêiner de injeção de dependências. O tempo é obtido por `TimeProvider`, o que permite testar expirações (7 dias do convite, 15 minutos de bloqueio) sem esperar.

**Fronts.** O `fluig-app` e o `portal` têm a mesma organização: `pages/` (uma tela por arquivo, com seu CSS), `components/` (botões, campos, tabelas, selos de situação, modais), `auth/` (sessão e leitura do token), `api/` (cliente HTTP, mensagens de erro e `schema.d.ts` gerado do contrato), `mocks/` (MSW, simulação da API baseada no contrato), `styles/` (variáveis de cor, tipografia e espaçamento da identidade visual da Jotanunes) e `utils/`. A área Jotanunes usa `HashRouter`, porque é aberta dentro do Fluig sem regra de reescrita no servidor; o portal usa rotas normais servidas pelo nginx.

## Convenções adotadas

- **Nomes em português** no domínio, nos casos de uso, nas tabelas e nas mensagens, alinhados ao vocabulário do cliente (obra, empresa, convite, envio, tipo de documento). Tabelas e colunas em *snake_case* (`envios_documento`, `motivo_rejeicao`); classes e métodos em *PascalCase* (`EnvioDocumento.Rejeitar`); componentes React em *PascalCase* e utilitários em *camelCase*.
- **Contrato como fonte de verdade.** O arquivo `openapi.yaml` define 43 operações, esquemas e códigos de erro. Os tipos TypeScript dos fronts são gerados dele, e um teste de contrato no backend confere rotas, `operationId`, enumerados, propriedades dos DTOs, títulos de erro e a marcação `x-requer-admin` das operações restritas a administradores.
- **Erros no formato `application/problem+json`** (RFC 9457), com um campo `code` estável (por exemplo `CNPJ_DUPLICADO`, `ENVIO_JA_ANALISADO`, `SEM_PERMISSAO`, `ACESSO_BLOQUEADO`), mensagem em português, erros por campo quando for validação e `traceId` para suporte. Erros inesperados devolvem `500 ERRO_INTERNO` sem expor detalhes internos.
- **Políticas de autorização nomeadas**: `Fluig` (área Jotanunes, com senha local já definida), `FluigSessao` (apenas sessão, usada em `/me`, trocar senha e sair), `FluigAdmin` (exige o papel de administrador; falha responde `403 SEM_PERMISSAO` antes de ler o corpo ou o banco e grava `PERMISSAO_NEGADA` na auditoria), `Portal` e `PortalCompleto` (portal, exigindo a troca de senha concluída).
- **Três esquemas de token isolados**, cada um com segredo, emissor e audiência próprios: o do Fluig, o do portal e o do login próprio. Um esquema seletor lê o emissor do token da área Jotanunes e o encaminha ao esquema correto; um token de uma área nunca é aceito na outra. Tokens do portal e do login próprio carregam a **versão da credencial** (`ver`), conferida a cada requisição, o que permite revogar sessões na hora.
- **Identificação da empresa sempre pelo token**: nas rotas do portal, o identificador da empresa nunca vem da URL ou do corpo; um envio de outra empresa responde 404, para não revelar sua existência.

## Trechos representativos

**Regra de negócio no domínio.** A rejeição de um envio valida o motivo e a transição de estado dentro da própria entidade:

```csharp
public void Rejeitar(string login, string nome, string? motivo, DateTimeOffset agora)
{
    var m = motivo?.Trim() ?? string.Empty;
    if (m.Length is < 5 or > 500)
    {
        throw ErroDominio.Validacao("motivo", "Informe o motivo da rejeição (de 5 a 500 caracteres).");
    }
    GarantirEmAnalise();          // só EM_ANALISE pode ser decidido
    Status = StatusEnvio.REJEITADO;
    MotivoRejeicao = m;
    RegistrarAnalise(login, nome, agora);
}
```

**Concorrência resolvida no banco.** Duas pessoas analisando o mesmo envio ao mesmo tempo: a decisão é gravada por uma atualização condicional, e só uma delas altera a linha; a outra recebe `409 ENVIO_JA_ANALISADO`.

```csharp
public async Task<bool> RegistrarDecisaoAsync(EnvioDocumento d, CancellationToken ct = default)
{
    var linhas = await db.Envios
        .Where(e => e.Id == d.Id && e.Status == StatusEnvio.EM_ANALISE)
        .ExecuteUpdateAsync(s => s
            .SetProperty(e => e.Status, d.Status)
            .SetProperty(e => e.AnalisadoEm, d.AnalisadoEm)
            .SetProperty(e => e.AnalisadoPorLogin, d.AnalisadoPorLogin)
            .SetProperty(e => e.AnalisadoPorNome, d.AnalisadoPorNome)
            .SetProperty(e => e.MotivoRejeicao, d.MotivoRejeicao), ct);
    return linhas == 1;
}
```

**Revogação imediata de sessão.** Na validação de cada token do portal, a API confere se a empresa continua ativa e se a versão da credencial ainda é a do token:

```csharp
var empresa = await empresas.ObterAsync(empresaId, ctx.HttpContext.RequestAborted);
if (empresa is null || !empresa.Ativa || empresa.VersaoCredencial != versao)
    ctx.Fail("credencial revogada");
```

## Boas práticas de programação adotadas

- **Comentários e documentação no código**: classes e casos de uso têm resumo (`/// <summary>`) explicando a regra, a ordem das operações e a referência ao requisito (por exemplo, "FR-062") ou à decisão de pesquisa (por exemplo, "research R17"). O histórico de autoria e datas é mantido pelo Git, e não em cabeçalhos manuais.
- **Padronização de nomes** de variáveis, parâmetros, métodos, tabelas e índices, descrita acima, com índices nomeados de forma explícita (`ix_envios_documento_vivo`).
- **Verificação de declarações e tipos**: C# com tipos anuláveis habilitados (`Nullable=enable`) e **avisos tratados como erros** (`TreatWarningsAsErrors=true`); TypeScript em modo estrito; ESLint nos fronts.
- **Tratamento de erros** em camadas: `ErroDominio` no domínio, convertido em `ErroAplicacao` com um `CodigoErro` do contrato, e um *middleware* único que escreve o `problem+json`. Operações com efeito externo seguem uma ordem definida: no convite, grava, envia o e-mail e só então confirma a transação (falha desfaz tudo); no envio de arquivo, grava o arquivo e depois o registro, apagando o arquivo se o registro for recusado.
- **Acesso a dados**: em vez de *stored procedures*, o acesso é feito por repositórios sobre o Entity Framework Core, com consultas parametrizadas e projeções sem rastreamento (`AsNoTracking`) nas listas; o banco garante unicidade e integridade com índices únicos, índices parciais e chaves estrangeiras.
- **Padrões de projeto**: portas e adaptadores (hexagonal), repositório, unidade de trabalho, caso de uso (*command*), método de fábrica nas entidades, objeto de valor, estratégia (adaptadores trocáveis de e-mail — Resend em produção e log em desenvolvimento — e de armazenamento) e *middleware* (cadeia de responsabilidade) na API.
- **Desempenho**: paginação no servidor, índices compostos para a fila de análise e para o histórico, contagens de documentos calculadas por consulta agregada e teste automatizado que garante listas abaixo de 2 segundos com 20.000 envios.
- **Simplicidade**: sem frameworks de CSS nem bibliotecas de estado nos fronts; componentes pequenos e reutilizáveis; nenhuma dependência além das necessárias.

## Segurança

A segurança foi tratada como princípio inegociável da constituição do projeto, com base na LGPD e no OWASP ASVS:

- **Senhas** guardadas somente como hash BCrypt (custo 12); senhas temporárias e provisórias de 12 caracteres geradas com gerador criptográfico e alfabeto sem caracteres ambíguos; política de senha forte; troca obrigatória no primeiro acesso.
- **Token do convite** de 32 bytes aleatórios, guardado apenas como hash SHA-256; o portal retira o token do endereço antes de validá-lo por `POST`, para que não fique em históricos nem em logs de proxy.
- **Proteção contra enumeração e força bruta**: mesma resposta e mesmo tempo de resposta para CNPJ ou login inexistente e senha errada (verificação BCrypt fictícia), bloqueio de 15 minutos após 5 falhas também para cadastros inexistentes (contador por HMAC, sem guardar o valor digitado) e limite de 10 requisições por minuto por IP nas rotas anônimas.
- **Isolamento entre empresas**: identificação sempre pelo token, respostas 404 para recursos de outra empresa e ocultação, para a empresa, de quem analisou o documento.
- **Arquivos**: formato identificado pelos bytes iniciais e verificação estrutural do final do arquivo (recusa arquivos truncados ou renomeados), limite de 10 MB, nome original saneado, arquivo gravado com nome interno gerado e caminho protegido contra fuga da pasta raiz.
- **Cabeçalhos de segurança** em todas as respostas (`X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`), CORS restrito às origens do portal e da área Jotanunes e HTTPS em todos os endereços.
- **Configuração validada na subida**: a API não inicia se os segredos de assinatura tiverem menos de 32 bytes, forem iguais entre si ou se faltar a configuração de e-mail fora do ambiente de desenvolvimento. Segredos de produção ficam em arquivo com permissão 0600 fora do controle de versão.
- **Auditoria e logs**: toda ação relevante (logins, convites, envios, downloads, decisões, permissões negadas, gestão de usuários) é registrada com ator, perfil, recurso e IP real (lido de `X-Forwarded-For` somente quando a conexão vem do proxy local). Logs em JSON, sem senhas, tokens ou conteúdo de arquivos — o que é verificado por testes automatizados.
