/**
 * Apelidos dos schemas gerados de `contracts/openapi.yaml` (arquivo `schema.d.ts`, gerado por
 * `npm run gen:api` — não editar à mão).
 */
import type { components, paths } from './schema';

export type { components, paths };
type S = components['schemas'];

export type CodigoErro = S['CodigoErro'];
export type Problema = S['Problema'];
export type Uf = S['Uf'];
export type SituacaoAcesso = S['SituacaoAcesso'];
export type SituacaoConvite = S['SituacaoConvite'];
export type StatusEnvio = S['StatusEnvio'];
export type SituacaoDocumento = S['SituacaoDocumento'];
export type FormatoArquivo = S['FormatoArquivo'];

export type UsuarioFluig = S['UsuarioFluig'];
export type OrigemSessao = S['OrigemSessao'];
export type ConfiguracaoAcesso = S['ConfiguracaoAcesso'];
export type LoginJotanunesInput = S['LoginJotanunesInput'];
export type SessaoJotanunes = S['SessaoJotanunes'];
export type TrocaSenhaInput = S['TrocaSenhaInput'];
export type AutorFluig = S['AutorFluig'];
export type Painel = S['Painel'];

export type ObraInput = S['ObraInput'];
export type ObraAtualizacao = S['ObraAtualizacao'];
export type Obra = S['Obra'];
export type ObraResumo = S['ObraResumo'];
export type ObraDetalhe = S['ObraDetalhe'];
export type ObraRef = S['ObraRef'];
export type PaginaObras = S['PaginaObras'];

export type EmpresaInput = S['EmpresaInput'];
export type EmpresaAtualizacao = S['EmpresaAtualizacao'];
export type ContagemDocumentos = S['ContagemDocumentos'];
export type EmpresaResumo = S['EmpresaResumo'];
export type Empresa = S['Empresa'];
export type EmpresaNaObra = S['EmpresaNaObra'];
export type EmpresaRef = S['EmpresaRef'];
export type PaginaEmpresas = S['PaginaEmpresas'];

export type Convite = S['Convite'];

export type TipoDocumentoInput = S['TipoDocumentoInput'];
export type TipoDocumentoAtualizacao = S['TipoDocumentoAtualizacao'];
export type TipoDocumento = S['TipoDocumento'];
export type TipoDocumentoRef = S['TipoDocumentoRef'];

export type Envio = S['Envio'];
export type EnvioFila = S['EnvioFila'];
export type PaginaEnvios = S['PaginaEnvios'];
export type Rejeicao = S['Rejeicao'];
export type DocumentoSituacao = S['DocumentoSituacao'];

export type SituacaoUsuarioInterno = S['SituacaoUsuarioInterno'];
export type UsuarioInterno = S['UsuarioInterno'];
export type UsuarioInternoInput = S['UsuarioInternoInput'];
export type UsuarioInternoAtualizacao = S['UsuarioInternoAtualizacao'];
export type PaginaUsuariosInternos = S['PaginaUsuariosInternos'];

export type ConsultaObras = NonNullable<paths['/api/fluig/obras']['get']['parameters']['query']>;
export type ConsultaEmpresas = NonNullable<paths['/api/fluig/empresas']['get']['parameters']['query']>;
export type ConsultaTipos = NonNullable<paths['/api/fluig/tipos-documento']['get']['parameters']['query']>;
export type ConsultaEnvios = NonNullable<paths['/api/fluig/envios']['get']['parameters']['query']>;
export type ConsultaUsuarios = NonNullable<paths['/api/fluig/usuarios']['get']['parameters']['query']>;
