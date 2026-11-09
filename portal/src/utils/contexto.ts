import { api } from '../api/client';

/**
 * Onde um documento vive: `null` = documento geral da empresa; senão, o id da obra. O mesmo tipo
 * pode aparecer em várias obras, então tudo o que identifica um documento usa contexto + tipo.
 */
export type ObraIdOuGeral = string | null;

/** Página da lista do contexto (resumo ou página da obra). */
export function caminhoLista(obraId: ObraIdOuGeral): string {
  return obraId ? `/obras/${encodeURIComponent(obraId)}` : '/documentos';
}

/** Histórico/envio de um documento no contexto. */
export function caminhoDocumento(obraId: ObraIdOuGeral, tipoDocumentoId: string): string {
  return `${caminhoLista(obraId)}${obraId ? '/documentos' : ''}/${encodeURIComponent(tipoDocumentoId)}`;
}

/** Página de períodos de um documento periódico no contexto. */
export function caminhoPeriodos(obraId: ObraIdOuGeral, tipoDocumentoId: string): string {
  return `${caminhoDocumento(obraId, tipoDocumentoId)}/periodos`;
}

/** Histórico de envios de um período (`?periodo=AAAA-MM-DD`). */
export function caminhoHistoricoPeriodo(
  obraId: ObraIdOuGeral,
  tipoDocumentoId: string,
  periodoInicio: string,
): string {
  return `${caminhoDocumento(obraId, tipoDocumentoId)}?periodo=${encodeURIComponent(periodoInicio)}`;
}

export function listarDocumentos(obraId: ObraIdOuGeral) {
  return obraId ? api.listarDocumentosObra(obraId) : api.listarDocumentos();
}

export function listarHistorico(
  obraId: ObraIdOuGeral,
  tipoDocumentoId: string,
  periodoInicio?: string | null,
) {
  return obraId
    ? api.listarHistoricoObra(obraId, tipoDocumentoId, periodoInicio)
    : api.listarHistorico(tipoDocumentoId, periodoInicio);
}

export function listarPeriodos(obraId: ObraIdOuGeral, tipoDocumentoId: string) {
  return obraId
    ? api.listarPeriodosObra(obraId, tipoDocumentoId)
    : api.listarPeriodos(tipoDocumentoId);
}

export function enviarDocumento(
  obraId: ObraIdOuGeral,
  tipoDocumentoId: string,
  arquivo: File,
  periodoInicio?: string | null,
) {
  return obraId
    ? api.enviarDocumentoObra(obraId, tipoDocumentoId, arquivo, periodoInicio)
    : api.enviarDocumento(tipoDocumentoId, arquivo, periodoInicio);
}
