import { HttpResponse } from 'msw';
import { MENSAGENS } from '../api/mensagens';
import type { CodigoErro, Problema } from '../api/tipos';

/** Resposta `application/problem+json` conforme o schema `Problema` do contrato. */
export function problema(
  status: number,
  code: CodigoErro,
  extras: Partial<Problema> = {},
): Response {
  const corpo: Problema = {
    type: `https://jotanunes.com/problemas/${code.toLowerCase().replace(/_/g, '-')}`,
    title: MENSAGENS[code],
    status,
    code,
    traceId: 'mock',
    ...extras,
  };
  return HttpResponse.json(corpo, {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}
