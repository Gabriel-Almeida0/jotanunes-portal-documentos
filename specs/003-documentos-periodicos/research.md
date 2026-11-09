# Research — 003 Documentos periódicos

## R1. Contrato único, 1.3.0 → 1.4.0

- **Decision**: alterar `specs/001-portal-documentos-terceirizadas/contracts/openapi.yaml` (mesmo motivo da 002 R1).
  Mudanças em [`contracts/mudancas-api.md`](contracts/mudancas-api.md). Operações 52 → **56**.

## R2. Periodicidade como três colunas no tipo

- **Decision**: `periodicidade_unidade` (`UNICA` | `MESES` | `DIAS`), `periodicidade_intervalo` (N; null se única) e
  `prazo_dias` (null se única). Mensal = MESES/1, Bimestral = MESES/2, Trimestral = MESES/3, Semestral = MESES/6,
  Anual = MESES/12. A "lista pronta" é só apresentação no front.
- **Rationale**: uma regra de cálculo só (unidade + N) cobre todos os casos validados.
- **Alternatives**: enum com MENSAL, TRIMESTRAL… + personalizado — rejeitado: duas regras de cálculo para o mesmo
  conceito.

## R3. Períodos derivados, não persistidos

- **Decision**: os períodos são calculados por uma função pura do domínio `CalendarioPeriodos.Gerar(unidade, N,
  inicioCobranca, hoje)` → lista de `(inicio, fim)` do primeiro período até o que contém `hoje`. O envio guarda
  `periodo_inicio`/`periodo_fim` (date). A situação de cada período usa a mesma `RegraSituacaoDocumento.De` sobre os
  envios daquele período; "atrasado" = `hoje > fim + prazo` e situação ∈ {PENDENTE_ENVIO, REJEITADO}.
- **Rationale**: nenhuma rotina agendada, nada para "materializar"; mudar o prazo recalcula tudo (spec).
- **Alternatives**: tabela de períodos gerada por job — rejeitado (princípio VI, sem necessidade).

## R4. Âncora dos períodos

- **Decision**: MESES — primeiro período começa no **dia 1 do mês** do início da cobrança e cada período tem N meses
  de calendário (fim = último dia do N-ésimo mês). DIAS — começa **no dia** do início da cobrança, blocos de N dias.
  Datas no fuso `America/Sao_Paulo` (o relógio da aplicação dá UTC; a conversão fica no domínio com
  `TimeZoneInfo`).
- **Decisão assumida** na spec (a validar).

## R5. Início da cobrança

- **Decision**: geral = `max(empresa.criado_em, tipo.cobranca_desde)`; por obra = `max(vinculo.vinculado_em,
  marcacao.marcado_em, tipo.cobranca_desde)`. Coluna nova `tipos_documento.cobranca_desde` = criação; atualizada
  quando o tipo é reativado ou passa de Único para periódico. `vinculado_em` já é atualizado na reabertura (002 R5) e
  `marcado_em` na remarcação (002 R3).

## R6. Unicidade por período

- **Decision**: o índice `ix_envios_documento_vivo` ganha `periodo_inicio`: `(empresa_id, tipo_documento_id, obra_id,
  periodo_inicio) NULLS NOT DISTINCT WHERE status <> 'REJEITADO'` — mesmo nome, mesmo mapeamento 23505 →
  `ENVIO_NAO_PERMITIDO`.

## R7. Envio: período escolhido pelo cliente, validado no servidor

- **Decision**: o upload recebe o campo multipart `periodoInicio` (`yyyy-MM-dd`), obrigatório para tipo periódico e
  proibido para único. O servidor recalcula os períodos exigidos e só aceita se `periodoInicio` for o início de um
  deles (senão 404 `NAO_ENCONTRADO` — inclui período futuro); grava `periodo_fim` e `enviado_com_atraso = agora >
  prazo`.

## R8. Contagens: documento conta uma vez

- **Decision**: `ContagemDocumentos` continua contando documentos (FR-320) pela situação resumida (FR-312, prioridade
  Atrasado > Rejeitado > Pendente > Em análise > Aprovado; "Atrasado" entra em `pendentes` ou `rejeitados` conforme a
  situação do período, para não mudar o significado dos campos) e ganha `periodosAtrasados`. Cálculo em memória na
  Application, por empresa, a partir de uma consulta agregada dos envios periódicos (envios por (empresa, obra, tipo,
  período) com a melhor situação) — volume pequeno (≤ 25 períodos × tipos periódicos).
- **Desempenho**: o teste de volume (`Desempenho/ListasTests`) ganha tipos mensais e deve continuar na meta; se não
  ficar, a consulta de "atrasados" vira SQL com `generate_series`.

## R9. Rótulo do período vem da API

- **Decision**: `Periodo.rotulo` em pt-BR gerado no domínio ("Março/2026"; "Jan–Mar/2026"; "2026" para 12 meses
  começando em janeiro; "Fev/2026–Jan/2027"; dias: "01/03 a 30/03/2026"). Os dois fronts só exibem.

## R10. Telas

- **Fluig**: `FormularioTipo` (já compartilhado) ganha "Periodicidade" (seleção com a lista pronta + "A cada N meses" +
  "A cada N dias", campo N, campo prazo, prévia em texto FR-332). Coluna "Periodicidade" e filtro na lista de tipos.
  `ModalPeriodos` reaproveitado no detalhe da empresa, aba Empresas da obra e envio. Fila: rótulo do período, selo
  "Com atraso", filtro. Painel: cartão "Empresas com período atrasado".
- **Portal**: `CartaoDocumento` de tipo periódico mostra periodicidade, resumo e "próximo período"; botão "Ver
  períodos" abre a página `/documentos/:tipo/periodos` ou `/obras/:obra/documentos/:tipo/periodos` com a lista e o
  envio por período.

## R11. Auditoria

- **Decision**: ação nova `TIPO_PERIODICIDADE_ALTERADA` (recurso `TIPO_DOCUMENTO`) quando periodicidade ou prazo
  mudam.
