# Portal da terceirizada — Jotanunes

SPA (React 18 + Vite 5 + TypeScript, CSS puro com os tokens `--jn-*` de `docs/design.md`) onde a
empresa terceirizada entra com **CNPJ + senha**, troca a senha no primeiro acesso, vê os documentos
exigidos, envia os arquivos e acompanha a análise. Contrato da API:
`specs/001-portal-documentos-terceirizadas/contracts/openapi.yaml` (fonte de verdade).

## Comandos

```bash
npm install
npm run dev          # http://localhost:5174
npm test             # Vitest + Testing Library + MSW
npm run lint         # ESLint + checagem "sem framework de CSS"
npm run check:css    # só a checagem de bibliotecas de CSS/componentes proibidas
npm run build        # tsc + vite build → dist/
npm run gen:api      # regenera src/api/schema.d.ts a partir do openapi.yaml
```

## Rodar com mocks (sem backend)

```bash
VITE_USE_MOCKS=true npm run dev
```

Os handlers MSW (`src/mocks/`) respondem conforme o contrato. Dados de exemplo:

| CNPJ | Senha | Cenário |
|---|---|---|
| `12.345.678/0001-95` | `Temp1234` → depois a nova (ex.: `Nova1234`) | Primeiro acesso: troca obrigatória; 3 documentos pendentes |
| `11.222.333/0001-81` | `Alfa2026ok` | Ativa, com documento rejeitado, em análise e aprovado |
| `99.888.777/0001-00` | `Delta2026ok` | Tudo aprovado → "Nenhum documento pendente. Tudo certo por aqui." |
| `12.ABC.345/01DE-35` | `Temp1234` | Convite expirado (CNPJ alfanumérico) |
| `33.444.555/0001-81` | `Gama2026ok` | Empresa desativada |

- Link de convite válido: `http://localhost:5174/acesso?convite=convite-exemplo-valido-00000000000000000000`
  (qualquer outro token → "Este link não é mais válido.").
- 5 senhas erradas seguidas no mesmo CNPJ → a 6ª tentativa mostra o bloqueio de 15 minutos.
- Enviar um arquivo cujo nome começa com `expirar-sessao` simula a sessão vencendo durante o envio.
- Os dados do mock ficam em memória: recarregar a página volta ao estado inicial (empresas já
  ativas continuam conectadas; a de primeiro acesso volta para `Temp1234`).

## Rodar com a API real

```bash
cp .env.example .env.local   # VITE_API_URL=http://localhost:5080, VITE_USE_MOCKS=false
npm run dev
```

A API (`backend/`) precisa estar no ar com `Cors__Origins` incluindo `http://localhost:5174`. O
passo a passo completo (compose, segredos, convite pelo `fluig-app`) está no
`specs/001-portal-documentos-terceirizadas/quickstart.md`. A senha temporária do convite aparece no
log da API em desenvolvimento.

## Estrutura

```text
src/
├── api/         schema.d.ts (gerado), tipos.ts, client.ts (Bearer, problem+json → ErroApi,
│                401 → login, 403 TROCA_SENHA_OBRIGATORIA → troca), mensagens.ts (titles do contrato)
├── auth/        SessaoProvider (memória + sessionStorage 'jn.portalToken'), RotaProtegida
├── components/  Cabecalho, Rodape, Botao, Campo, Selo, TituloPagina, Alerta, EnvioArquivo,
│                CartaoDocumento, BotaoBaixar, Carregando, icons/ (SVG inline)
├── pages/       Acesso, TrocaSenha, MeusDocumentos, DocumentoHistorico
├── mocks/       dados.ts, handlers/ (acesso, documentos), browser.ts, server.ts
├── styles/      tokens.css (cópia de docs/design.md §10), base.css
├── utils/       cnpj.ts (máscara + DV numérico/alfanumérico), datas.ts (America/Sao_Paulo),
│                arquivo.ts (PDF/JPG/PNG ≤ 10 MB, confere a assinatura dos bytes), senha.ts
└── test/        setup.ts (MSW + jest-dom), utils.tsx
```

Rotas: `/acesso` (com `?convite=`), `/trocar-senha`, `/documentos`, `/documentos/:tipoDocumentoId`.
Em produção, o servidor estático precisa devolver `index.html` para essas rotas (BrowserRouter).
