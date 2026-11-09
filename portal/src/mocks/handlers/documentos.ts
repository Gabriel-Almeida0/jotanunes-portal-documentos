import { delay, http, HttpResponse } from 'msw';
import type {
  DocumentoSituacaoPortal,
  EnvioPortal,
  ObraPortal,
  PeriodoPortal,
} from '../../api/tipos';
import { autenticar } from '../autenticacao';
import {
  banco,
  dataLocal,
  detectarFormato,
  documentosDaObra,
  documentosGerais,
  enviosDoDocumento,
  obraDoPortal,
  obrasDaEmpresa,
  periodosDoDocumento,
  proximoId,
  tiposDaObra,
  type TipoMock,
} from '../dados';
import { problema } from '../problema';

const LIMITE_BYTES = 10 * 1024 * 1024;

/**
 * Recebe o arquivo de um documento (geral ou da obra). `documento` já vem resolvido no contexto
 * certo; `undefined` = fora do alcance → 404.
 */
async function receberEnvio(
  request: Request,
  empresaId: string,
  documento: DocumentoSituacaoPortal | undefined,
  obraId: string | null,
): Promise<Response> {
  if (!documento) return problema(404, 'NAO_ENCONTRADO');

  const dados = await request.formData().catch(() => null);
  const arquivo = dados?.get('arquivo');
  if (!arquivo || typeof arquivo === 'string') {
    return problema(400, 'VALIDACAO', { errors: { arquivo: ['Escolha um arquivo.'] } });
  }

  // Cenário de demonstração: sessão que expira no meio do envio.
  if (arquivo.name.startsWith('expirar-sessao')) return problema(401, 'NAO_AUTENTICADO');

  // Periódico: período obrigatório e exigido; único: período proibido (contrato 1.4.0).
  const campoPeriodo = dados?.get('periodoInicio');
  const periodoInicio = typeof campoPeriodo === 'string' && campoPeriodo ? campoPeriodo : null;
  const tipo = banco.tipos.find((t) => t.id === documento.tipoDocumento.id)!;
  const periodico = tipo.periodicidade.unidade !== 'UNICA';
  if (periodico !== (periodoInicio !== null)) return problema(400, 'PERIODO_OBRIGATORIO');
  let periodo: PeriodoPortal | undefined;
  if (periodoInicio) {
    periodo = periodosDoDocumento(empresaId, tipo, obraId).find((p) => p.inicio === periodoInicio);
    // Período futuro ou data que não é início de período → não encontrado.
    if (!periodo) return problema(404, 'NAO_ENCONTRADO');
    if (!periodo.podeEnviar) return problema(409, 'ENVIO_NAO_PERMITIDO');
  } else if (!documento.podeEnviar) {
    return problema(409, 'ENVIO_NAO_PERMITIDO');
  }
  if (arquivo.size > LIMITE_BYTES) return problema(413, 'ARQUIVO_MUITO_GRANDE');
  if (arquivo.size === 0) return problema(400, 'ARQUIVO_INVALIDO');

  const conteudo = new Uint8Array(await arquivo.arrayBuffer());
  const formato = detectarFormato(conteudo);
  if (!formato) return problema(415, 'ARQUIVO_TIPO_NAO_SUPORTADO');

  const envio: EnvioPortal = {
    id: proximoId(),
    tipoDocumentoId: documento.tipoDocumento.id,
    obraId,
    nomeArquivo: arquivo.name,
    formato,
    tamanhoBytes: arquivo.size,
    enviadoEm: new Date().toISOString(),
    status: 'EM_ANALISE',
    analisadoEm: null,
    motivoRejeicao: null,
    periodo: periodo ? { inicio: periodo.inicio, fim: periodo.fim, rotulo: periodo.rotulo } : null,
    enviadoComAtraso: periodo ? dataLocal() > periodo.prazo : false,
  };
  banco.envios.push({ ...envio, obraId, empresaId, conteudo });
  return HttpResponse.json<EnvioPortal>(envio, { status: 201 });
}

/** Tipo periódico no alcance (geral: ativo; obra: marcado e obra acessível) ou `null` → 404. */
function tipoPeriodico(tipos: TipoMock[], tipoDocumentoId: string): TipoMock | null {
  const tipo = tipos.find((t) => t.id === tipoDocumentoId);
  return tipo && tipo.periodicidade.unidade !== 'UNICA' ? tipo : null;
}

const periodoDaBusca = (request: Request) => new URL(request.url).searchParams.get('periodoInicio');

const atrasoEnvio = () => delay(import.meta.env.MODE === 'test' ? 0 : 900);

/** Handlers de "Portal - Documentos" (gerais, por obra, histórico, envio e download). */
export const handlersDocumentos = [
  // Só documentos gerais (tipos GERAL ativos).
  http.get('*/api/portal/documentos', async ({ request }) => {
    await delay();
    const auth = autenticar(request, true);
    if ('resposta' in auth) return auth.resposta;
    return HttpResponse.json<DocumentoSituacaoPortal[]>(documentosGerais(auth.empresa.empresa.id));
  }),

  // Só tipo GERAL; POR_OBRA → 404.
  http.get<{ tipoDocumentoId: string }>(
    '*/api/portal/documentos/:tipoDocumentoId/envios',
    async ({ request, params }) => {
      await delay();
      const auth = autenticar(request, true);
      if ('resposta' in auth) return auth.resposta;
      const tipo = banco.tipos.find((t) => t.id === params.tipoDocumentoId);
      if (!tipo || tipo.abrangencia !== 'GERAL') return problema(404, 'NAO_ENCONTRADO');
      return HttpResponse.json<EnvioPortal[]>(
        enviosDoDocumento(
          auth.empresa.empresa.id,
          params.tipoDocumentoId,
          null,
          periodoDaBusca(request),
        ),
      );
    },
  ),

  // Períodos do documento geral periódico (POR_OBRA ou UNICA → 404).
  http.get<{ tipoDocumentoId: string }>(
    '*/api/portal/documentos/:tipoDocumentoId/periodos',
    async ({ request, params }) => {
      await delay();
      const auth = autenticar(request, true);
      if ('resposta' in auth) return auth.resposta;
      const tipo = tipoPeriodico(
        banco.tipos.filter((t) => t.abrangencia === 'GERAL' && t.ativo),
        params.tipoDocumentoId,
      );
      if (!tipo) return problema(404, 'NAO_ENCONTRADO');
      return HttpResponse.json<PeriodoPortal[]>(
        periodosDoDocumento(auth.empresa.empresa.id, tipo, null),
      );
    },
  ),

  http.post<{ tipoDocumentoId: string }>(
    '*/api/portal/documentos/:tipoDocumentoId/envios',
    async ({ request, params }) => {
      await atrasoEnvio();
      const auth = autenticar(request, true);
      if ('resposta' in auth) return auth.resposta;
      const empresaId = auth.empresa.empresa.id;
      const documento = documentosGerais(empresaId).find(
        (d) => d.tipoDocumento.id === params.tipoDocumentoId,
      );
      return receberEnvio(request, empresaId, documento, null);
    },
  ),

  http.get('*/api/portal/obras', async ({ request }) => {
    await delay();
    const auth = autenticar(request, true);
    if ('resposta' in auth) return auth.resposta;
    return HttpResponse.json<ObraPortal[]>(obrasDaEmpresa(auth.empresa.empresa.id));
  }),

  http.get<{ obraId: string }>(
    '*/api/portal/obras/:obraId/documentos',
    async ({ request, params }) => {
      await delay();
      const auth = autenticar(request, true);
      if ('resposta' in auth) return auth.resposta;
      const empresaId = auth.empresa.empresa.id;
      // Vínculo encerrado, obra inativa ou de outra empresa → 404 (nunca 403).
      if (!obraDoPortal(empresaId, params.obraId)) return problema(404, 'NAO_ENCONTRADO');
      return HttpResponse.json<DocumentoSituacaoPortal[]>(
        documentosDaObra(empresaId, params.obraId),
      );
    },
  ),

  http.get<{ obraId: string; tipoDocumentoId: string }>(
    '*/api/portal/obras/:obraId/documentos/:tipoDocumentoId/envios',
    async ({ request, params }) => {
      await delay();
      const auth = autenticar(request, true);
      if ('resposta' in auth) return auth.resposta;
      const empresaId = auth.empresa.empresa.id;
      const marcado = documentosDaObra(empresaId, params.obraId).some(
        (d) => d.tipoDocumento.id === params.tipoDocumentoId,
      );
      if (!marcado) return problema(404, 'NAO_ENCONTRADO');
      return HttpResponse.json<EnvioPortal[]>(
        enviosDoDocumento(
          empresaId,
          params.tipoDocumentoId,
          params.obraId,
          periodoDaBusca(request),
        ),
      );
    },
  ),

  // Períodos do documento periódico da obra (mesmo isolamento das outras rotas de obra).
  http.get<{ obraId: string; tipoDocumentoId: string }>(
    '*/api/portal/obras/:obraId/documentos/:tipoDocumentoId/periodos',
    async ({ request, params }) => {
      await delay();
      const auth = autenticar(request, true);
      if ('resposta' in auth) return auth.resposta;
      const empresaId = auth.empresa.empresa.id;
      const tipo = obraDoPortal(empresaId, params.obraId)
        ? tipoPeriodico(tiposDaObra(params.obraId), params.tipoDocumentoId)
        : null;
      if (!tipo) return problema(404, 'NAO_ENCONTRADO');
      return HttpResponse.json<PeriodoPortal[]>(
        periodosDoDocumento(empresaId, tipo, params.obraId),
      );
    },
  ),

  http.post<{ obraId: string; tipoDocumentoId: string }>(
    '*/api/portal/obras/:obraId/documentos/:tipoDocumentoId/envios',
    async ({ request, params }) => {
      await atrasoEnvio();
      const auth = autenticar(request, true);
      if ('resposta' in auth) return auth.resposta;
      const empresaId = auth.empresa.empresa.id;
      const documento = documentosDaObra(empresaId, params.obraId).find(
        (d) => d.tipoDocumento.id === params.tipoDocumentoId,
      );
      return receberEnvio(request, empresaId, documento, params.obraId);
    },
  ),

  http.get<{ envioId: string }>(
    '*/api/portal/envios/:envioId/arquivo',
    async ({ request, params }) => {
      await delay();
      const auth = autenticar(request, true);
      if ('resposta' in auth) return auth.resposta;
      const empresaId = auth.empresa.empresa.id;
      const envio = banco.envios.find((e) => e.id === params.envioId && e.empresaId === empresaId);
      // Envio de outra empresa, ou de obra sem vínculo ativo / inativa → 404 (nunca 403).
      if (!envio || (envio.obraId && !obraDoPortal(empresaId, envio.obraId))) {
        return problema(404, 'NAO_ENCONTRADO');
      }
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
