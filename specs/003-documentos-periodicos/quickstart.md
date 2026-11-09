# Quickstart — 003 Documentos periódicos

Subir igual à 001/002. A migration `DocumentosPeriodicos` roda na subida em Development.

```bash
(cd backend && dotnet test)
(cd fluig-app && npm run gen:api && npm run lint && npm run check:css && npm test && npm run build)
(cd portal && npm run gen:api && npm run lint && npm test && npm run build)
```

Esperado: contrato com 56 operações; tudo verde.

## Roteiro ponta a ponta (API real)

Datas de exemplo supõem "hoje" = 26/10/2026; ajuste ao dia.

1. **Migração** — tipos existentes aparecem "Único"; envios e situações iguais (SC-303).
2. **Tipo mensal geral** — crie "Guia do FGTS", Geral, Mensal, prazo 15. Prévia: "Mensal · um arquivo por mês, até o
   dia 15 do mês seguinte". Lista de tipos mostra a periodicidade; filtro "Periódicos" traz só ele.
3. **Portal, período em curso** — empresa já existente: cartão "Guia do FGTS" com "Próximo: Outubro/2026 · prazo
   15/11/2026"; "Ver períodos" lista só Outubro/2026 (cobrança começa na criação do tipo).
4. **Tipo por obra a cada 3 meses** — na aba da obra, "Novo tipo por obra": "Relatório trimestral", A cada 3 meses,
   prazo 10. Para a empresa vinculada nesta obra, o primeiro período começa no mês da marcação.
5. **Atraso** (precisa de um período vencido): no banco de testes, recue `tipos_documento.cobranca_desde` do "Guia do
   FGTS" para 2026-07-01. Portal: Julho, Agosto e Setembro/2026 "Atrasado", Outubro "Pendente de envio"; cartão
   "3 atrasados".
6. **Enviar com atraso** — envie para Agosto/2026: fica "Em análise", marcado "enviado com atraso"; os outros meses não
   mudam. Tentar Novembro/2026 (futuro) pela API → 404.
7. **Fila** — linha "Guia do FGTS · Agosto/2026" com "Com atraso"; filtro "Com atraso" traz só ela.
8. **Rejeitar** — e-mail cita "Agosto/2026"; portal mostra Agosto "Rejeitado" + motivo.
9. **Painel e empresa** — "Empresas com período atrasado" ≥ 1; detalhe da empresa mostra "Guia do FGTS — 3 atrasados"
   e a lista de períodos com quem analisou.
10. **Imutável** — mudar "Guia do FGTS" para Único → 409 `PERIODICIDADE_IMUTAVEL`; mudar só o prazo para 20 → aceito e
    prazos recalculados.
11. **Isolamento** — outra empresa: `GET /api/portal/documentos/{guia}/periodos` mostra os períodos **dela**;
    `GET /api/portal/obras/{obra sem vínculo}/documentos/{tipo}/periodos` → 404.

## Resultado — 2026-10-26

- Testes: backend 616 (Domain 159, Application 45, Api 412, incluindo Desempenho — pior resposta 433 ms); fluig-app
  260 (3 execuções seguidas verdes; um teste com espera curta ganhou folga de tempo); portal 103. Lint, `check:css` e
  builds verdes.
- Roteiro executado por script contra a API real (banco descartável `jotanunes_docs_e2e003`, e-mails no log):
  31 verificações, todas ok — períodos e rótulos, atrasos, envio com atraso, 404 para período futuro/inválido, 400
  `PERIODO_OBRIGATORIO`, 409 no mesmo período, fila "com atraso", e-mail com o período, painel, edição sem
  periodicidade mantém a atual, 409 `PERIODICIDADE_IMUTAVEL`, trimestral por obra (Out–Dez/2026, prazo 10/01/2027),
  isolamento.
- Telas abertas contra a API real (tipos + formulário, empresa + períodos, fila; portal resumo + períodos, em 390 px):
  sem erro de console nem 4xx/5xx inesperado.
- Pendências conhecidas: na área Jotanunes, a lista de períodos de um tipo **desativado** segue até hoje (a data de
  desativação não é guardada); o portal responde 404 para tipo inativo.
