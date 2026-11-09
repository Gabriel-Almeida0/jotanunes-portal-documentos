# Quickstart — 002 Documentos por obra

Como subir tudo: igual à 001 ([quickstart](../001-portal-documentos-terceirizadas/quickstart.md)). A migration
`DocumentosPorObra` roda sozinha na subida da API em Development.

## Testes automáticos

```bash
(cd backend && dotnet test)                       # Docker ligado (Testcontainers)
(cd fluig-app && npm run gen:api && npm run lint && npm test)
(cd portal && npm run gen:api && npm run lint && npm test)
```

Esperado: `ContratoOpenApiTests` com 52 operações; `PerfilAdminTests` classificando as rotas novas; todos verdes.

## Roteiro ponta a ponta (API real)

Preparação: um administrador na área Jotanunes (`http://localhost:5173`), duas obras **A** e **B**, uma empresa
**E** convidada e com senha trocada no portal (`http://localhost:5174`).

1. **Migração preserva o que existe** — antes de subir a 002, anote a situação dos documentos de uma empresa já
   existente. Depois: tipos aparecem como "Geral da empresa", mesmos envios e situações (SC-203).
2. **Tipo por obra** — em "Tipos de documento", crie "ART da obra" com abrangência *Por obra*. Filtre por
   abrangência: aparece só em "Por obra".
3. **Exigir na obra** — abra a obra A → aba "Documentos exigidos" → marque "ART da obra". Na obra B, não marque.
4. **Vincular** — vincule E às obras A e B.
5. **Portal: resumo** — entre como E: aparecem "Documentos gerais", cartão da obra A ("0 de 1 aprovados", 1
   pendente) e cartão da obra B ("Nenhum documento exigido nesta obra" / "Tudo certo nesta obra.").
6. **Portal: enviar na obra A** — abra a obra A, envie um PDF para "ART da obra": fica "Em análise" só na obra A; os
   gerais não mudam.
7. **Mesmo tipo em duas obras** — marque "ART da obra" também na obra B. No portal, obra B mostra "Pendente de
   envio" (independente da A).
8. **Fila** — na área Jotanunes, a fila mostra a linha com a coluna Obra = A; filtro "Obra B" não a mostra;
   "Somente gerais" não a mostra.
9. **Rejeitar** — rejeite com motivo: o e-mail (log da API em dev) cita a obra A; no portal, obra A mostra
   "Rejeitado" + motivo e "Enviar novo arquivo".
10. **Detalhes** — detalhe da obra A, aba Empresas: E com progresso da obra e resumo dos gerais separado. Detalhe
    de E: "Documentos gerais" + blocos A e B.
11. **Encerrar vínculo** — desvincule E da obra A: a confirmação informa quantos envios existem. Portal: obra A some;
    tentar `GET /api/portal/obras/{A}/documentos` com o token de E → 404. Área Jotanunes: obra A → "Vínculos
    encerrados" mostra E e o histórico abre.
12. **Reabrir** — vincule E à obra A de novo: no portal a obra A volta com o histórico e a situação anterior.
13. **Isolamento** — com o token de outra empresa F, `GET /api/portal/obras/{A}/documentos` → 404;
    `GET /api/portal/envios/{id do envio de E}/arquivo` → 404.
14. **Perfil comum** — com token comum, `PUT /api/fluig/obras/{A}/tipos-documento/{tipo}` → 403 `SEM_PERMISSAO`; a
    aba "Documentos exigidos" aparece em modo leitura.
15. **Abrangência imutável** — tentar mudar "ART da obra" para *Geral* → 409 `ABRANGENCIA_IMUTAVEL` com mensagem na
    tela.

## Resultado — 2026-10-26

- Testes: backend 536 (Domain 116, Application 44, Api 376, incluindo Desempenho); fluig-app 225; portal 87. Lint,
  `check:css` e builds verdes.
- Roteiro acima executado por script contra a API real (banco descartável `jotanunes_docs_e2e002`, e-mails no log):
  55 verificações, todas conforme o esperado. (A verificação "obras com pendência: B não" do script estava errada: a
  empresa F, também na obra B, não tinha enviado a ART — a obra B tem pendência de fato.)
- Telas abertas no navegador contra a API real (painel, obra com abas, empresa, fila, tipos; portal resumo e obra,
  inclusive em 390 px): sem erro de console nem resposta 4xx/5xx inesperada.
- Ajuste feito na validação: no portal, "Suas obras" passou a vir antes dos documentos gerais (com 10 gerais, a
  pendência da obra ficava no fim da página).
- Pendências conhecidas: botão "Encerrar vínculo" encostado na borda direita da tabela da aba Empresas (visual);
  duas desmarcações simultâneas do mesmo tipo numa obra podem responder 500 (sem efeito no dado); o `Down` da
  migration falha se já houver, para a mesma empresa e tipo, envios vivos em obras diferentes.
