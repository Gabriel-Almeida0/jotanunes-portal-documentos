import { handlersAnalise } from './analise';
import { handlersConvites } from './convites';
import { handlersEmpresas } from './empresas';
import { handlersObras } from './obras';
import { handlersSessao } from './sessao';
import { handlersTiposDocumento } from './tiposDocumento';

export const handlers = [
  ...handlersSessao,
  ...handlersObras,
  ...handlersConvites,
  ...handlersAnalise,
  ...handlersEmpresas,
  ...handlersTiposDocumento,
];
