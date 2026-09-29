import { delay, http, HttpResponse } from 'msw';
import type { DocumentoSituacaoPortal, EnvioPortal } from '../../api/tipos';
import { autenticar } from '../autenticacao';
import { banco, detectarFormato, documentosDaEmpresa, enviosDaEmpresa, proximoId } from '../dados';
import { problema } from '../problema';

const LIMITE_BYTES = 10 * 1024 * 1024;

/** Handlers de "Portal - Documentos" (lista, histórico, envio e download). */
export const handlersDocumentos = [
  http.get('*/api/portal/documentos', async ({ request }) => {
    await delay();
    const auth = autenticar(request, true);
    if ('resposta' in auth) return auth.resposta;
    return HttpResponse.json<DocumentoSituacaoPortal[]>(
      documentosDaEmpresa(auth.empresa.empresa.id),
    );
  }),

  http.get<{ tipoDocumentoId: string }>(
    '*/api/portal/documentos/:tipoDocumentoId/envios',
    async ({ request, params }) => {
      await delay();
      const auth = autenticar(request, true);
      if ('resposta' in auth) return auth.resposta;
      if (!banco.tipos.some((t) => t.id === params.tipoDocumentoId)) {
        return problema(404, 'NAO_ENCONTRADO');
      }
      return HttpResponse.json<EnvioPortal[]>(
        enviosDaEmpresa(auth.empresa.empresa.id, params.tipoDocumentoId),
      );
    },
  ),

  http.post<{ tipoDocumentoId: string }>(
    '*/api/portal/documentos/:tipoDocumentoId/envios',
    async ({ request, params }) => {
      await delay(import.meta.env.MODE === 'test' ? 0 : 900);
      const auth = autenticar(request, true);
      if ('resposta' in auth) return auth.resposta;
      const empresaId = auth.empresa.empresa.id;

      const documento = documentosDaEmpresa(empresaId).find(
        (d) => d.tipoDocumento.id === params.tipoDocumentoId,
      );
      if (!documento) return problema(404, 'NAO_ENCONTRADO');

      const dados = await request.formData().catch(() => null);
      const arquivo = dados?.get('arquivo');
      if (!arquivo || typeof arquivo === 'string') {
        return problema(400, 'VALIDACAO', { errors: { arquivo: ['Escolha um arquivo.'] } });
      }

      // Cenário de demonstração: sessão que expira no meio do envio.
      if (arquivo.name.startsWith('expirar-sessao')) return problema(401, 'NAO_AUTENTICADO');

      if (!documento.podeEnviar) return problema(409, 'ENVIO_NAO_PERMITIDO');
      if (arquivo.size > LIMITE_BYTES) return problema(413, 'ARQUIVO_MUITO_GRANDE');
      if (arquivo.size === 0) return problema(400, 'ARQUIVO_INVALIDO');

      const conteudo = new Uint8Array(await arquivo.arrayBuffer());
      const formato = detectarFormato(conteudo);
      if (!formato) return problema(415, 'ARQUIVO_TIPO_NAO_SUPORTADO');

      const envio: EnvioPortal = {
        id: proximoId(),
        tipoDocumentoId: params.tipoDocumentoId,
        nomeArquivo: arquivo.name,
        formato,
        tamanhoBytes: arquivo.size,
        enviadoEm: new Date().toISOString(),
        status: 'EM_ANALISE',
        analisadoEm: null,
        motivoRejeicao: null,
      };
      banco.envios.push({ ...envio, empresaId, conteudo });
      return HttpResponse.json<EnvioPortal>(envio, { status: 201 });
    },
  ),

  http.get<{ envioId: string }>(
    '*/api/portal/envios/:envioId/arquivo',
    async ({ request, params }) => {
      await delay();
      const auth = autenticar(request, true);
      if ('resposta' in auth) return auth.resposta;
      const envio = banco.envios.find(
        (e) => e.id === params.envioId && e.empresaId === auth.empresa.empresa.id,
      );
      // Envio de outra empresa → 404 (nunca 403).
      if (!envio) return problema(404, 'NAO_ENCONTRADO');
      return new HttpResponse(envio.conteudo.slice().buffer, {
        status: 200,
        headers: {
          'Content-Type': envio.formato,
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(envio.nomeArquivo)}`,
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'no-store',
        },
      });
    },
  ),
];
