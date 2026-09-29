# fluig-app — Área Jotanunes

Interface interna da Jotanunes para o Portal de Documentação de Terceirizadas. Abre **de dentro do
Fluig** (iframe ou nova aba), sem login próprio: a identidade vem de um token emitido pelo Fluig.
Aqui a analista cadastra obras, empresas, vínculos e tipos de documento, envia convites e analisa os
documentos enviados.

- Stack: React 18 + Vite 5 + TypeScript (strict), `react-router-dom` 6 (`HashRouter`).
- Visual: **CSS puro** com os tokens `--jn-*` de [`docs/design.md`](../docs/design.md), tudo escopado
  em `.jn-app` (não conflita com o tema do Fluig). Sem framework/biblioteca de CSS ou componentes
  (`npm run check:css` confere). Ícones em SVG inline.
- Contrato: [`specs/001-portal-documentos-terceirizadas/contracts/openapi.yaml`](../specs/001-portal-documentos-terceirizadas/contracts/openapi.yaml).
  Os tipos TypeScript são gerados dele (`npm run gen:api` → `src/api/schema.d.ts`, não editar à mão).

## Scripts

| Comando | O que faz |
|---|---|
| `npm install` | Instala as dependências (Node 22) |
| `npm run dev` | Servidor de desenvolvimento em http://localhost:5173 |
| `npm run build` | Checagem de tipos + build de produção em `dist/` |
| `npm test` | Testes (Vitest + Testing Library + MSW) |
| `npm run lint` | ESLint |
| `npm run gen:api` | Regenera `src/api/schema.d.ts` a partir do contrato |
| `npm run check:css` | Falha se houver framework/biblioteca de CSS no `package.json` |

## Variáveis de ambiente

Copie `.env.example` para `.env.local` (não versionado):

| Variável | Uso |
|---|---|
| `VITE_API_URL` | URL da API. Dev: `http://localhost:5080` |
| `VITE_USE_MOCKS` | `true` = respostas simuladas (MSW) conforme o contrato, sem backend |
| `VITE_FLUIG_DEV_TOKEN` | Só em `npm run dev`: token Fluig usado quando a URL não traz `#fluigToken=` |

## Rodar com mocks (sem backend)

```bash
cd fluig-app
npm install
VITE_USE_MOCKS=true npm run dev
```

Abra http://localhost:5173. Com mocks e sem token, o app usa um token fictício de desenvolvimento e
entra como **Analista Dev**. Os dados ficam em memória (recarregar a página volta ao estado inicial).

Cenários úteis nos mocks:

- `http://localhost:5173/#fluigToken=expirado` → tela "Abra este sistema pelo Fluig." (401 no `/me`).
- Empresa com e-mail de contato contendo `falha` (ex.: `falha@teste.test`) → o convite devolve
  `EMAIL_FALHOU` (502).
- Empresas de exemplo: Alfa (acesso ativo, com envios aprovados, rejeitado e em análise), Beta
  (convidada, CNPJ alfanumérico `12.ABC.345/01DE-35`), Gama (não convidada), Delta (convite expirado),
  Épsilon (desativada) e Zeta (envios em análise).

## Rodar com a API real

1. Suba o Postgres e a API conforme o [quickstart](../specs/001-portal-documentos-terceirizadas/quickstart.md).
2. Gere um token de desenvolvimento na raiz do repositório:

   ```bash
   node scripts/gerar-token-fluig-dev.mjs dev.analista "Analista Dev" analista@jotanunes.com
   ```

3. Em `fluig-app/.env.local`:

   ```bash
   VITE_API_URL=http://localhost:5080
   VITE_USE_MOCKS=false
   VITE_FLUIG_DEV_TOKEN=<token gerado>
   ```

4. `npm run dev` e abra http://localhost:5173 — ou, sem `VITE_FLUIG_DEV_TOKEN`, abra
   `http://localhost:5173/#fluigToken=<token>`.

A API precisa liberar a origem `http://localhost:5173` em `Cors__Origins`.

## Como o Fluig abre o app

Contrato completo em [`contracts/fluig-identity.md`](../specs/001-portal-documentos-terceirizadas/contracts/fluig-identity.md).

1. Um widget/página do Fluig gera um JWT HS256 do usuário logado (`iss=fluig`,
   `aud=jotanunes-docs-api`, `sub`=login, `name`, `email`, validade ≤ 8 h).
2. O widget abre `{URL do fluig-app}/#fluigToken=<jwt>` em iframe ou nova aba.
3. O app lê o token do fragmento, **apaga o fragmento da URL** (`history.replaceState`), guarda o
   token em memória e em `sessionStorage['jn.fluigToken']` e chama `GET /api/fluig/me`.
4. Sem token, ou com token recusado (401), aparece só "Abra este sistema pelo Fluig." — nenhum dado
   é carregado.

O build usa `base: './'` e `HashRouter`, então `dist/` pode ser servido em qualquer caminho, sem
regra de reescrita. Em produção, o servidor que hospeda o app deve enviar
`Content-Security-Policy: frame-ancestors <domínio do Fluig>`.

## Telas e rotas

| Rota | Tela |
|---|---|
| `#/` | Painel: indicadores com atalhos para as listas filtradas |
| `#/obras` | Obras: busca, situação, paginação, cadastro |
| `#/obras/:obraId` | Obra: dados, ativar/desativar, empresas vinculadas, vincular/desvincular |
| `#/empresas` | Empresas: busca por nome/CNPJ, filtros por obra, situação de acesso e pendência |
| `#/empresas/:empresaId` | Empresa: dados editáveis, acesso ao portal e convites, obras, documentos e histórico |
| `#/tipos-documento` | Tipos de documento: cadastro, edição, ativar/desativar |
| `#/analise` | Fila de análise: em análise (mais antigo primeiro) e analisados, com filtros |
| `#/analise/:envioId` | Análise do envio: abrir/baixar arquivo, aprovar, rejeitar com motivo |

## Estrutura

```text
src/
├── api/          schema.d.ts (gerado), client.ts (fetch + ErroApi), fluig.ts (uma função por rota), useConsulta.ts
├── auth/         tokenFluig.ts (fragmento/sessionStorage/dev), AuthFluigProvider.tsx, contexto.ts
├── components/   Botao, Campo, Selo, TituloPagina, Tabela, Paginacao, Modal, Filtros, Alerta, Estados, Layout, icons/
├── hooks/        useAviso, useFormularioEmpresa
├── mocks/        MSW: dados.ts (banco em memória), handlers/*, browser.ts, server.ts
├── pages/        uma página por rota (+ .css) e seus testes
├── styles/       tokens.css (docs/design.md §10 em .jn-app), base.css, paginas.css
├── test/         setup.ts (jest-dom + servidor MSW), renderizar.tsx
└── utils/        cnpj.ts (numérico e alfanumérico), datas.ts (America/Sao_Paulo), formatos.ts
```

Mensagens de erro exibidas ao usuário vêm do `title` do `application/problem+json` da API (tabela
`CodigoErro` do contrato); `src/api/mensagens.ts` só é usado como reserva quando não há corpo.
