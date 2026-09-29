import { MENSAGENS, MENSAGEM_FALHA_REDE } from './mensagens';
import type {
  CodigoErro,
  ConviteValidacao,
  ConviteValidacaoInput,
  DocumentoSituacaoPortal,
  EmpresaPortal,
  EnvioPortal,
  LoginInput,
  Problema,
  SessaoPortal,
  TrocaSenhaInput,
} from './tipos';

export const API_URL: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/** Código do erro: os do contrato + `FALHA_REDE` (sem resposta do servidor). */
export type CodigoErroApi = CodigoErro | 'FALHA_REDE';

export class ErroApi extends Error {
  readonly status: number;
  readonly code: CodigoErroApi;
  readonly title: string;
  readonly errors: Record<string, string[]>;
  readonly bloqueadoAte: string | null;

  constructor(dados: {
    status: number;
    code: CodigoErroApi;
    title: string;
    errors?: Record<string, string[]> | null;
    bloqueadoAte?: string | null;
  }) {
    super(dados.title);
    this.name = 'ErroApi';
    this.status = dados.status;
    this.code = dados.code;
    this.title = dados.title;
    this.errors = dados.errors ?? {};
    this.bloqueadoAte = dados.bloqueadoAte ?? null;
  }

  /** Primeira mensagem de um campo (chave camelCase do contrato), se houver. */
  erroDoCampo(campo: string): string | undefined {
    return this.errors[campo]?.[0];
  }
}

/** Contexto da chamada: define o aviso mostrado no login se a sessão cair. */
export type ContextoChamada = 'geral' | 'envio';

interface ConfiguracaoCliente {
  obterToken: () => string | null;
  aoNaoAutenticado: (contexto: ContextoChamada) => void;
  aoTrocaSenhaObrigatoria: () => void;
}

let configuracao: ConfiguracaoCliente = {
  obterToken: () => null,
  aoNaoAutenticado: () => {},
  aoTrocaSenhaObrigatoria: () => {},
};

/** Chamado pelo SessaoProvider para ligar o cliente à sessão e à navegação. */
export function configurarCliente(nova: Partial<ConfiguracaoCliente>): void {
  configuracao = { ...configuracao, ...nova };
}

function codigoConhecido(code: unknown): code is CodigoErro {
  return typeof code === 'string' && code in MENSAGENS;
}

async function paraErroApi(resposta: Response): Promise<ErroApi> {
  let problema: Partial<Problema> = {};
  try {
    problema = (await resposta.json()) as Partial<Problema>;
  } catch {
    // corpo vazio ou não-JSON: usa a mensagem padrão do status
  }
  const code: CodigoErro = codigoConhecido(problema.code)
    ? problema.code
    : resposta.status === 401
      ? 'NAO_AUTENTICADO'
      : resposta.status === 404
        ? 'NAO_ENCONTRADO'
        : resposta.status === 429
          ? 'LIMITE_REQUISICOES'
          : 'ERRO_INTERNO';
  return new ErroApi({
    status: resposta.status,
    code,
    title: problema.title || MENSAGENS[code],
    errors: problema.errors ?? null,
    bloqueadoAte: problema.bloqueadoAte ?? null,
  });
}

interface OpcoesRequisicao {
  metodo?: 'GET' | 'POST';
  corpo?: unknown;
  autenticada?: boolean;
  contexto?: ContextoChamada;
  accept?: string;
}

async function requisitarBruto(caminho: string, opcoes: OpcoesRequisicao = {}): Promise<Response> {
  const { metodo = 'GET', corpo, autenticada = true, contexto = 'geral' } = opcoes;
  const headers: Record<string, string> = { Accept: opcoes.accept ?? 'application/json' };
  const token = autenticada ? configuracao.obterToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (corpo instanceof FormData) {
    body = corpo;
  } else if (corpo !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(corpo);
  }

  let resposta: Response;
  try {
    resposta = await fetch(`${API_URL}${caminho}`, { method: metodo, headers, body });
  } catch {
    throw new ErroApi({ status: 0, code: 'FALHA_REDE', title: MENSAGEM_FALHA_REDE });
  }

  if (resposta.ok) return resposta;

  const erro = await paraErroApi(resposta);
  // 401 numa rota autenticada = sessão ausente, vencida ou revogada (login/convite não entram aqui).
  if (erro.status === 401 && autenticada) {
    configuracao.aoNaoAutenticado(contexto);
  } else if (erro.status === 403 && erro.code === 'TROCA_SENHA_OBRIGATORIA') {
    configuracao.aoTrocaSenhaObrigatoria();
  }
  throw erro;
}

async function requisitarJson<T>(caminho: string, opcoes?: OpcoesRequisicao): Promise<T> {
  const resposta = await requisitarBruto(caminho, opcoes);
  return (await resposta.json()) as T;
}

/** Envia um arquivo (multipart, campo `arquivo`) para a URL indicada. */
export async function enviarArquivo<T>(caminho: string, arquivo: File): Promise<T> {
  const dados = new FormData();
  dados.append('arquivo', arquivo, arquivo.name);
  return requisitarJson<T>(caminho, { metodo: 'POST', corpo: dados, contexto: 'envio' });
}

function nomeDoContentDisposition(valor: string | null): string | null {
  if (!valor) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(valor);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      return utf8[1].trim();
    }
  }
  const simples = /filename="?([^";]+)"?/i.exec(valor);
  return simples ? simples[1].trim() : null;
}

/** Baixa um arquivo autenticado (Bearer) como Blob e dispara o download no navegador. */
export async function baixarArquivo(caminho: string, nomeSugerido: string): Promise<void> {
  const resposta = await requisitarBruto(caminho, { accept: '*/*' });
  const blob = await resposta.blob();
  const nome =
    nomeDoContentDisposition(resposta.headers.get('Content-Disposition')) ?? nomeSugerido;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const segmento = (valor: string) => encodeURIComponent(valor);

/** Operações do portal (contrato `openapi.yaml`, tags "Portal - *"). */
export const api = {
  /** O token do convite é segredo: vai no corpo, nunca na URL (caminho/query acabam em logs). */
  validarConvite: (token: string) =>
    requisitarJson<ConviteValidacao>('/api/portal/convites/validar', {
      metodo: 'POST',
      corpo: { token } satisfies ConviteValidacaoInput,
      autenticada: false,
    }),

  login: (dados: LoginInput) =>
    requisitarJson<SessaoPortal>('/api/portal/auth/login', {
      metodo: 'POST',
      corpo: dados,
      autenticada: false,
    }),

  trocarSenha: (dados: TrocaSenhaInput) =>
    requisitarJson<SessaoPortal>('/api/portal/auth/trocar-senha', { metodo: 'POST', corpo: dados }),

  empresaAtual: () => requisitarJson<EmpresaPortal>('/api/portal/me'),

  listarDocumentos: () => requisitarJson<DocumentoSituacaoPortal[]>('/api/portal/documentos'),

  listarHistorico: (tipoDocumentoId: string) =>
    requisitarJson<EnvioPortal[]>(`/api/portal/documentos/${segmento(tipoDocumentoId)}/envios`),

  enviarDocumento: (tipoDocumentoId: string, arquivo: File) =>
    enviarArquivo<EnvioPortal>(
      `/api/portal/documentos/${segmento(tipoDocumentoId)}/envios`,
      arquivo,
    ),

  baixarArquivoEnvio: (envio: Pick<EnvioPortal, 'id' | 'nomeArquivo'>) =>
    baixarArquivo(`/api/portal/envios/${segmento(envio.id)}/arquivo`, envio.nomeArquivo),
};
