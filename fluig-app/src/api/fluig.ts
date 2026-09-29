/**
 * Uma função por operação `/api/fluig/*` do contrato (tipos vindos de `schema.d.ts`).
 */
import { abrirArquivoEmNovaAba, baixarArquivo, requisicao } from './client';
import type {
  ConsultaEmpresas,
  ConsultaEnvios,
  ConsultaObras,
  ConsultaTipos,
  ConsultaUsuarios,
  ConfiguracaoAcesso,
  Convite,
  DocumentoSituacao,
  Empresa,
  EmpresaAtualizacao,
  EmpresaInput,
  Envio,
  LoginJotanunesInput,
  EnvioFila,
  Obra,
  ObraAtualizacao,
  ObraDetalhe,
  ObraInput,
  PaginaEmpresas,
  PaginaEnvios,
  PaginaObras,
  PaginaUsuariosInternos,
  Painel,
  SessaoJotanunes,
  TipoDocumento,
  TipoDocumentoAtualizacao,
  TipoDocumentoInput,
  TrocaSenhaInput,
  UsuarioFluig,
  UsuarioInterno,
  UsuarioInternoAtualizacao,
  UsuarioInternoInput,
} from './tipos';

const id = encodeURIComponent;

export const api = {
  // Sessão
  me: (sinal?: AbortSignal) => requisicao<UsuarioFluig>('GET', '/api/fluig/me', { sinal }),
  painel: (sinal?: AbortSignal) => requisicao<Painel>('GET', '/api/fluig/painel', { sinal }),

  // Acesso (login próprio da área Jotanunes). `configuracaoAcesso` e `login` são anônimas: não
  // enviam o token e o 401 do login (credencial errada) não derruba sessão nenhuma.
  configuracaoAcesso: (sinal?: AbortSignal) =>
    requisicao<ConfiguracaoAcesso>('GET', '/api/fluig/auth/configuracao', { sinal, anonimo: true }),
  login: (dados: LoginJotanunesInput) =>
    requisicao<SessaoJotanunes>('POST', '/api/fluig/auth/login', { corpo: dados, anonimo: true }),
  trocarSenha: (dados: TrocaSenhaInput) =>
    requisicao<SessaoJotanunes>('POST', '/api/fluig/auth/trocar-senha', { corpo: dados }),
  sair: () => requisicao<void>('POST', '/api/fluig/auth/sair'),

  // Usuários internos (só administrador)
  listarUsuarios: (consulta: ConsultaUsuarios = {}, sinal?: AbortSignal) =>
    requisicao<PaginaUsuariosInternos>('GET', '/api/fluig/usuarios', { consulta, sinal }),
  obterUsuario: (usuarioId: string, sinal?: AbortSignal) =>
    requisicao<UsuarioInterno>('GET', `/api/fluig/usuarios/${id(usuarioId)}`, { sinal }),
  criarUsuario: (dados: UsuarioInternoInput) =>
    requisicao<UsuarioInterno>('POST', '/api/fluig/usuarios', { corpo: dados }),
  atualizarUsuario: (usuarioId: string, dados: UsuarioInternoAtualizacao) =>
    requisicao<UsuarioInterno>('PUT', `/api/fluig/usuarios/${id(usuarioId)}`, { corpo: dados }),
  redefinirSenhaUsuario: (usuarioId: string) =>
    requisicao<UsuarioInterno>('POST', `/api/fluig/usuarios/${id(usuarioId)}/redefinir-senha`),

  // Obras
  listarObras: (consulta: ConsultaObras = {}, sinal?: AbortSignal) =>
    requisicao<PaginaObras>('GET', '/api/fluig/obras', { consulta, sinal }),
  criarObra: (dados: ObraInput) => requisicao<Obra>('POST', '/api/fluig/obras', { corpo: dados }),
  obterObra: (obraId: string, sinal?: AbortSignal) =>
    requisicao<ObraDetalhe>('GET', `/api/fluig/obras/${id(obraId)}`, { sinal }),
  atualizarObra: (obraId: string, dados: ObraAtualizacao) =>
    requisicao<Obra>('PUT', `/api/fluig/obras/${id(obraId)}`, { corpo: dados }),
  vincularEmpresa: (obraId: string, empresaId: string) =>
    requisicao<void>('PUT', `/api/fluig/obras/${id(obraId)}/empresas/${id(empresaId)}`),
  desvincularEmpresa: (obraId: string, empresaId: string) =>
    requisicao<void>('DELETE', `/api/fluig/obras/${id(obraId)}/empresas/${id(empresaId)}`),

  // Empresas
  listarEmpresas: (consulta: ConsultaEmpresas = {}, sinal?: AbortSignal) =>
    requisicao<PaginaEmpresas>('GET', '/api/fluig/empresas', { consulta, sinal }),
  criarEmpresa: (dados: EmpresaInput) =>
    requisicao<Empresa>('POST', '/api/fluig/empresas', { corpo: dados }),
  obterEmpresa: (empresaId: string, sinal?: AbortSignal) =>
    requisicao<Empresa>('GET', `/api/fluig/empresas/${id(empresaId)}`, { sinal }),
  atualizarEmpresa: (empresaId: string, dados: EmpresaAtualizacao) =>
    requisicao<Empresa>('PUT', `/api/fluig/empresas/${id(empresaId)}`, { corpo: dados }),

  // Convites
  listarConvites: (empresaId: string, sinal?: AbortSignal) =>
    requisicao<Convite[]>('GET', `/api/fluig/empresas/${id(empresaId)}/convites`, { sinal }),
  enviarConvite: (empresaId: string) =>
    requisicao<Convite>('POST', `/api/fluig/empresas/${id(empresaId)}/convites`),

  // Documentos da empresa
  listarDocumentosEmpresa: (empresaId: string, sinal?: AbortSignal) =>
    requisicao<DocumentoSituacao[]>('GET', `/api/fluig/empresas/${id(empresaId)}/documentos`, {
      sinal,
    }),
  listarHistoricoEnvios: (empresaId: string, tipoDocumentoId: string, sinal?: AbortSignal) =>
    requisicao<Envio[]>(
      'GET',
      `/api/fluig/empresas/${id(empresaId)}/documentos/${id(tipoDocumentoId)}/envios`,
      { sinal },
    ),

  // Tipos de documento
  listarTipos: (consulta: ConsultaTipos = {}, sinal?: AbortSignal) =>
    requisicao<TipoDocumento[]>('GET', '/api/fluig/tipos-documento', { consulta, sinal }),
  criarTipo: (dados: TipoDocumentoInput) =>
    requisicao<TipoDocumento>('POST', '/api/fluig/tipos-documento', { corpo: dados }),
  obterTipo: (tipoId: string, sinal?: AbortSignal) =>
    requisicao<TipoDocumento>('GET', `/api/fluig/tipos-documento/${id(tipoId)}`, { sinal }),
  atualizarTipo: (tipoId: string, dados: TipoDocumentoAtualizacao) =>
    requisicao<TipoDocumento>('PUT', `/api/fluig/tipos-documento/${id(tipoId)}`, { corpo: dados }),

  // Análise
  listarEnvios: (consulta: ConsultaEnvios = {}, sinal?: AbortSignal) =>
    requisicao<PaginaEnvios>('GET', '/api/fluig/envios', { consulta, sinal }),
  obterEnvio: (envioId: string, sinal?: AbortSignal) =>
    requisicao<EnvioFila>('GET', `/api/fluig/envios/${id(envioId)}`, { sinal }),
  aprovarEnvio: (envioId: string) =>
    requisicao<Envio>('POST', `/api/fluig/envios/${id(envioId)}/aprovar`),
  rejeitarEnvio: (envioId: string, motivo: string) =>
    requisicao<Envio>('POST', `/api/fluig/envios/${id(envioId)}/rejeitar`, { corpo: { motivo } }),
  caminhoArquivoEnvio: (envioId: string) => `/api/fluig/envios/${id(envioId)}/arquivo`,
  baixarArquivoEnvio: (envioId: string) => baixarArquivo(`/api/fluig/envios/${id(envioId)}/arquivo`),
  abrirArquivoEnvio: (envioId: string) =>
    abrirArquivoEmNovaAba(`/api/fluig/envios/${id(envioId)}/arquivo`),
};

/**
 * Carrega todas as páginas de uma lista paginada (máx. 100 por página, conforme o contrato).
 * Usado para preencher os selects de filtro (obras, empresas).
 */
export async function listarTodas<T>(
  buscarPagina: (pagina: number) => Promise<{ itens: T[]; total: number; tamanhoPagina: number }>,
): Promise<T[]> {
  const primeira = await buscarPagina(1);
  const paginas = Math.ceil(primeira.total / primeira.tamanhoPagina);
  if (paginas <= 1) return primeira.itens;
  const resto = await Promise.all(
    Array.from({ length: paginas - 1 }, (_, i) => buscarPagina(i + 2)),
  );
  return [...primeira.itens, ...resto.flatMap((p) => p.itens)];
}

export const listarTodasObras = (sinal?: AbortSignal) =>
  listarTodas((pagina) => api.listarObras({ pagina, tamanhoPagina: 100 }, sinal));

export const listarTodasEmpresas = (sinal?: AbortSignal) =>
  listarTodas((pagina) => api.listarEmpresas({ pagina, tamanhoPagina: 100 }, sinal));
