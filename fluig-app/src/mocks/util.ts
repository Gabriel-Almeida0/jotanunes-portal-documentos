import { HttpResponse, delay } from 'msw';
import { MENSAGENS_ERRO, STATUS_ERRO } from '../api/mensagens';
import type { CodigoErro, Problema } from '../api/tipos';

/** Prefixo que casa com qualquer `VITE_API_URL` (ou nenhuma). */
export const API = '*/api/fluig';

/** Resposta `application/problem+json` conforme o schema `Problema` do contrato. */
export function problema(
  code: CodigoErro,
  extras: Partial<Problema> & { status?: number } = {},
): HttpResponse<Problema> {
  const status = extras.status ?? STATUS_ERRO[code];
  const corpo: Problema = {
    type: `https://jotanunes.com/problemas/${code.toLowerCase().replace(/_/g, '-')}`,
    title: MENSAGENS_ERRO[code],
    status,
    code,
    traceId: `mock-${Math.random().toString(16).slice(2, 10)}`,
    ...extras,
  };
  return HttpResponse.json(corpo, {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

export function validacao(errors: Record<string, string[]>): HttpResponse<Problema> {
  return problema('VALIDACAO', { errors });
}

/**
 * Esquema fluigAuth simulado: sem Bearer, ou com os tokens `invalido`/`expirado`/`portal:*` → 401.
 * Qualquer outro token é aceito como o usuário de desenvolvimento.
 */
export function exigirFluig(request: Request): HttpResponse<Problema> | null {
  const auth = request.headers.get('authorization') ?? '';
  const token = /^Bearer\s+(.+)$/i.exec(auth)?.[1]?.trim();
  if (!token || token === 'invalido' || token === 'expirado' || token.startsWith('portal:')) {
    return problema('NAO_AUTENTICADO');
  }
  return null;
}

/** Latência realista no navegador (MSW ignora em Node/testes). */
export async function latencia(): Promise<void> {
  await delay();
}

export function paginar<T>(
  lista: T[],
  url: URL,
): { itens: T[]; total: number; pagina: number; tamanhoPagina: number } | HttpResponse<Problema> {
  const pagina = Number(url.searchParams.get('pagina') ?? '1');
  const tamanhoPagina = Number(url.searchParams.get('tamanhoPagina') ?? '20');
  const errors: Record<string, string[]> = {};
  if (!Number.isInteger(pagina) || pagina < 1) errors.pagina = ['A página deve ser 1 ou maior.'];
  if (!Number.isInteger(tamanhoPagina) || tamanhoPagina < 1 || tamanhoPagina > 100) {
    errors.tamanhoPagina = ['O tamanho da página deve ser de 1 a 100.'];
  }
  if (Object.keys(errors).length) return validacao(errors);
  const inicio = (pagina - 1) * tamanhoPagina;
  return { itens: lista.slice(inicio, inicio + tamanhoPagina), total: lista.length, pagina, tamanhoPagina };
}

/** Minúsculas e sem acentos, para busca. */
export function simplificar(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function booleano(valor: string | null): boolean | undefined {
  if (valor === 'true') return true;
  if (valor === 'false') return false;
  return undefined;
}

export function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

export function textoOpcional(valor: unknown): string | null {
  const t = texto(valor);
  return t ? t : null;
}

export function adicionarErro(errors: Record<string, string[]>, campo: string, msg: string): void {
  (errors[campo] ??= []).push(msg);
}
