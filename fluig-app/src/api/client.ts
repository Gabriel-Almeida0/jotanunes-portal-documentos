/**
 * Cliente HTTP único do fluig-app.
 * - Base: `VITE_API_URL`.
 * - Injeta `Authorization: Bearer <token Fluig>`.
 * - Converte `application/problem+json` em `ErroApi { status, code, title, errors }`.
 * - Em 401 dispara o evento `jn:nao-autenticado` (o AuthFluigProvider mostra "Abra este sistema pelo Fluig.").
 * - 403 (`SEM_PERMISSAO`: operação só para administradores) é só um `ErroApi` para a tela exibir; a
 *   sessão continua.
 */
import { MENSAGEM_SEM_CONEXAO, MENSAGENS_ERRO } from './mensagens';
import type { CodigoErro, Problema } from './tipos';

export const EVENTO_NAO_AUTENTICADO = 'jn:nao-autenticado';

let tokenFluig: string | null = null;

export function definirTokenFluig(token: string | null): void {
  tokenFluig = token;
}

export function obterTokenFluig(): string | null {
  return tokenFluig;
}

export function urlBaseApi(): string {
  const base = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
  return base.replace(/\/+$/, '');
}

export class ErroApi extends Error {
  readonly status: number;
  readonly code: CodigoErro;
  readonly title: string;
  readonly errors: Record<string, string[]>;
  readonly detail?: string | null;

  constructor(dados: {
    status: number;
    code: CodigoErro;
    title?: string;
    errors?: Record<string, string[]> | null;
    detail?: string | null;
  }) {
    const title = dados.title || MENSAGENS_ERRO[dados.code] || MENSAGENS_ERRO.ERRO_INTERNO;
    super(title);
    this.name = 'ErroApi';
    this.status = dados.status;
    this.code = dados.code;
    this.title = title;
    this.errors = dados.errors ?? {};
    this.detail = dados.detail;
  }

  /** Primeira mensagem do campo (para exibir abaixo do input). */
  erroDoCampo(campo: string): string | undefined {
    return this.errors[campo]?.[0];
  }
}

/**
 * `true` para 403 `SEM_PERMISSAO` (operação só de administrador). A tela fecha o modal, mostra o
 * `title` e mantém os dados — nunca derruba a sessão.
 */
export function ehSemPermissao(erro: unknown): erro is ErroApi {
  return erro instanceof ErroApi && erro.code === 'SEM_PERMISSAO';
}

/** Converte qualquer erro em mensagem pronta para a tela. */
export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof ErroApi) return erro.title;
  return MENSAGENS_ERRO.ERRO_INTERNO;
}

type Consulta = Record<string, string | number | boolean | null | undefined>;

export function montarUrl(caminho: string, consulta?: Consulta): string {
  const params = new URLSearchParams();
  if (consulta) {
    for (const [chave, valor] of Object.entries(consulta)) {
      if (valor === undefined || valor === null || valor === '') continue;
      params.set(chave, String(valor));
    }
  }
  const qs = params.toString();
  return `${urlBaseApi()}${caminho}${qs ? `?${qs}` : ''}`;
}

function cabecalhos(extra?: HeadersInit): Headers {
  const h = new Headers(extra);
  h.set('Accept', 'application/json, application/problem+json');
  if (tokenFluig) h.set('Authorization', `Bearer ${tokenFluig}`);
  return h;
}

async function erroDaResposta(resposta: Response): Promise<ErroApi> {
  let corpo: Partial<Problema> | null = null;
  try {
    const tipo = resposta.headers.get('content-type') ?? '';
    if (tipo.includes('json')) corpo = (await resposta.json()) as Partial<Problema>;
  } catch {
    corpo = null;
  }
  const code: CodigoErro =
    (corpo?.code as CodigoErro | undefined) ?? codigoPorStatus(resposta.status);
  return new ErroApi({
    status: resposta.status,
    code,
    title: corpo?.title,
    errors: corpo?.errors ?? null,
    detail: corpo?.detail ?? null,
  });
}

function codigoPorStatus(status: number): CodigoErro {
  switch (status) {
    case 400:
      return 'VALIDACAO';
    case 401:
      return 'NAO_AUTENTICADO';
    case 403:
      return 'SEM_PERMISSAO';
    case 404:
      return 'NAO_ENCONTRADO';
    case 429:
      return 'LIMITE_REQUISICOES';
    default:
      return 'ERRO_INTERNO';
  }
}

async function executar(url: string, init: RequestInit): Promise<Response> {
  let resposta: Response;
  try {
    resposta = await fetch(url, init);
  } catch {
    throw new ErroApi({ status: 0, code: 'ERRO_INTERNO', title: MENSAGEM_SEM_CONEXAO });
  }
  if (!resposta.ok) {
    const erro = await erroDaResposta(resposta);
    if (resposta.status === 401) {
      window.dispatchEvent(new CustomEvent(EVENTO_NAO_AUTENTICADO));
    }
    throw erro;
  }
  return resposta;
}

export interface OpcoesRequisicao {
  consulta?: Consulta;
  corpo?: unknown;
  sinal?: AbortSignal;
}

/** Requisição JSON. Devolve `undefined` em 204. */
export async function requisicao<T>(
  metodo: 'GET' | 'POST' | 'PUT' | 'DELETE',
  caminho: string,
  opcoes: OpcoesRequisicao = {},
): Promise<T> {
  const init: RequestInit = { method: metodo, headers: cabecalhos(), signal: opcoes.sinal };
  if (opcoes.corpo !== undefined) {
    (init.headers as Headers).set('Content-Type', 'application/json');
    init.body = JSON.stringify(opcoes.corpo);
  }
  const resposta = await executar(montarUrl(caminho, opcoes.consulta), init);
  if (resposta.status === 204) return undefined as T;
  const texto = await resposta.text();
  return (texto ? JSON.parse(texto) : undefined) as T;
}

export interface ArquivoBaixado {
  url: string;
  nome: string;
  tipo: string;
  liberar: () => void;
}

/** Nome do arquivo de `Content-Disposition` (`filename*=UTF-8''...` ou `filename="..."`). */
export function nomeDoContentDisposition(valor: string | null): string | null {
  if (!valor) return null;
  const estendido = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(valor);
  if (estendido) {
    try {
      return decodeURIComponent(estendido[1].trim().replace(/^"|"$/g, ''));
    } catch {
      return estendido[1];
    }
  }
  const simples = /filename\s*=\s*"?([^";]+)"?/i.exec(valor);
  return simples ? simples[1].trim() : null;
}

/**
 * Baixa um arquivo autenticado (fetch → Blob → URL.createObjectURL). O arquivo nunca é servido por
 * URL pública: a URL criada vale só nesta aba e deve ser liberada depois de usada.
 */
export async function baixarArquivo(caminho: string): Promise<ArquivoBaixado> {
  const resposta = await executar(montarUrl(caminho), {
    method: 'GET',
    headers: (() => {
      const h = cabecalhos();
      h.set('Accept', '*/*');
      return h;
    })(),
  });
  const blob = await resposta.blob();
  const url = URL.createObjectURL(blob);
  return {
    url,
    nome: nomeDoContentDisposition(resposta.headers.get('content-disposition')) ?? 'arquivo',
    tipo: blob.type,
    liberar: () => URL.revokeObjectURL(url),
  };
}

/**
 * Abre o arquivo em nova aba. A aba é aberta antes do download (para não ser bloqueada como
 * pop-up); se o navegador bloquear mesmo assim, o arquivo é salvo como download.
 */
export async function abrirArquivoEmNovaAba(caminho: string): Promise<void> {
  const aba = window.open('', '_blank');
  try {
    const arquivo = await baixarArquivo(caminho);
    if (aba && !aba.closed) {
      aba.location.href = arquivo.url;
    } else {
      salvarComo(arquivo);
    }
    // Dá tempo para a aba carregar antes de liberar a memória.
    window.setTimeout(arquivo.liberar, 60_000);
  } catch (erro) {
    aba?.close();
    throw erro;
  }
}

export function salvarComo(arquivo: ArquivoBaixado): void {
  const a = document.createElement('a');
  a.href = arquivo.url;
  a.download = arquivo.nome;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
