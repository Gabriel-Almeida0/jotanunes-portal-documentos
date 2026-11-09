import type { DocumentoSituacaoPortal, PeriodoComPrazo, ResumoPeriodos } from '../api/tipos';
import { formatarData, hojeLocal } from './datas';

const plural = (n: number, singular: string, varios: string) =>
  `${n} ${n === 1 ? singular : varios}`;

/** Documento de tipo periódico (tem períodos; "Único" segue o fluxo de antes). */
export function ehPeriodico(documento: DocumentoSituacaoPortal): boolean {
  return documento.tipoDocumento.periodicidade.unidade !== 'UNICA';
}

/**
 * Resumo escrito dos períodos, ex.: "2 atrasados · 1 em análise". Os atrasados são períodos
 * pendentes ou rejeitados com prazo vencido; os demais pendentes/rejeitados viram "a enviar".
 */
export function textoResumoPeriodos(resumo: ResumoPeriodos): string {
  const aEnviar = Math.max(0, resumo.pendentes + resumo.rejeitados - resumo.atrasados);
  return [
    resumo.atrasados > 0 && plural(resumo.atrasados, 'atrasado', 'atrasados'),
    aEnviar > 0 && `${aEnviar} a enviar`,
    resumo.emAnalise > 0 && `${resumo.emAnalise} em análise`,
    resumo.aprovados > 0 && plural(resumo.aprovados, 'aprovado', 'aprovados'),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Prazo escrito: "até 15/11/2026" ou, se já passou, "prazo venceu em 15/09/2026". */
export function textoPrazo(periodo: Pick<PeriodoComPrazo, 'prazo'>): string {
  return hojeLocal() > periodo.prazo
    ? `prazo venceu em ${formatarData(periodo.prazo)}`
    : `até ${formatarData(periodo.prazo)}`;
}
