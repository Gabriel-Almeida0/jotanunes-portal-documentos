import { handlersAcesso } from './acesso';
import { handlersDocumentos } from './documentos';

export const handlers = [...handlersAcesso, ...handlersDocumentos];
