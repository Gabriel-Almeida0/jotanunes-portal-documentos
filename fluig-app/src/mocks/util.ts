import { HttpResponse, delay } from 'msw';
import { MENSAGENS_ERRO, STATUS_ERRO } from '../api/mensagens';
import type { CodigoErro, Problema } from '../api/tipos';
import { resolverSessao, type SessaoResolvida } from './dados';

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

function tokenDaRequisicao(request: Request): string | null {
  const auth = request.headers.get('authorization') ?? '';
  return /^Bearer\s+(.+)$/i.exec(auth)?.[1]?.trim() ?? null;
}

/** Sessão da requisição (ou `null` quando o token falta, é inválido ou foi revogado). */
export function sessaoDe(request: Request): SessaoResolvida | null {
  return resolverSessao(tokenDaRequisicao(request));
}

/**
 * Rotas de sessão (`/me`, `/auth/trocar-senha`, `/auth/sair`): só exigem um token válido — valem
 * também com a troca de senha pendente.
 */
export function exigirSessao(request: Request): HttpResponse<Problema> | null {
  return sessaoDe(request) ? null : problema('NAO_AUTENTICADO');
}

/**
 * Esquema fluigAuth simulado (ver `resolverSessao`): sem Bearer, com os tokens
 * `invalido`/`expirado`/`portal:*` ou com token do login próprio revogado → 401. Login próprio com
 * troca de senha pendente → 403 `TROCA_SENHA_OBRIGATORIA` (regra global do contrato).
 */
export function exigirFluig(request: Request): HttpResponse<Problema> | null {
  const sessao = sessaoDe(request);
  if (!sessao) return problema('NAO_AUTENTICADO');
  if (sessao.usuario.trocaSenhaObrigatoria) return problema('TROCA_SENHA_OBRIGATORIA');
  return null;
}

/**
 * Operações `x-requer-admin` do contrato: usuário comum (Fluig ou login próprio) → 403
 * `SEM_PERMISSAO`. Chamar logo depois de `exigirFluig` (sem token continua 401) e antes de ler o
 * corpo ou procurar o recurso (FR-083).
 */
export function exigirAdmin(request: Request): HttpResponse<Problema> | null {
  return sessaoDe(request)?.usuario.admin ? null : problema('SEM_PERMISSAO');
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
