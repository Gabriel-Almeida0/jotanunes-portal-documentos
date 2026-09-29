import { handlersAcesso } from './acesso';
import { handlersAnalise } from './analise';
import { handlersConvites } from './convites';
import { handlersEmpresas } from './empresas';
import { handlersObras } from './obras';
import { handlersSessao } from './sessao';
import { handlersTiposDocumento } from './tiposDocumento';
import { handlersUsuarios } from './usuarios';

export const handlers = [
  ...handlersAcesso,
  ...handlersSessao,
  ...handlersObras,
  ...handlersConvites,
  ...handlersAnalise,
  ...handlersEmpresas,
  ...handlersTiposDocumento,
  ...handlersUsuarios,
];
