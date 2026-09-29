import { http, HttpResponse } from 'msw';
import type { StatusEnvio } from '../../api/tipos';
import {
  USUARIO_MOCK,
  agoraIso,
  db,
  enviosDe,
  paraDocumentoSituacao,
  paraEnvio,
  paraEnvioFila,
  tiposAtivos,
} from '../dados';
import { API, exigirAdmin, exigirFluig, latencia, paginar, problema, validacao } from '../util';
import { pdfExemplo, pngExemplo } from './arquivoExemplo';

const STATUS: StatusEnvio[] = ['EM_ANALISE', 'APROVADO', 'REJEITADO'];

export const handlersAnalise = [
  http.get(`${API}/envios`, async ({ request }) => {
    await latencia();
    const negado = exigirFluig(request);
    if (negado) return negado;
    const url = new URL(request.url);
    const status = (url.searchParams.get('status') ?? 'EM_ANALISE') as StatusEnvio;
    if (!STATUS.includes(status)) return validacao({ status: ['Situação inválida.'] });
    const obraId = url.searchParams.get('obraId');
    const empresaId = url.searchParams.get('empresaId');
    const tipoId = url.searchParams.get('tipoDocumentoId');
    const lista = db.envios
      .filter((e) => e.status === status)
      .filter((e) => !obraId || db.vinculos.some((v) => v.obraId === obraId && v.empresaId === e.empresaId))
      .filter((e) => !empresaId || e.empresaId === empresaId)
      .filter((e) => !tipoId || e.tipoDocumentoId === tipoId)
      .sort((a, b) =>
        status === 'EM_ANALISE'
          ? a.enviadoEm.localeCompare(b.enviadoEm)
          : b.enviadoEm.localeCompare(a.enviadoEm),
      )
      .map(paraEnvioFila);
    const pagina = paginar(lista, url);
    return pagina instanceof HttpResponse ? pagina : HttpResponse.json(pagina);
  }),

  http.get(`${API}/envios/:envioId`, async ({ request, params }) => {
    await latencia();
    const negado = exigirFluig(request);
    if (negado) return negado;
    const envio = db.envios.find((e) => e.id === params.envioId);
    return envio ? HttpResponse.json(paraEnvioFila(envio)) : problema('NAO_ENCONTRADO');
  }),

  http.get(`${API}/envios/:envioId/arquivo`, async ({ request, params }) => {
    await latencia();
    const negado = exigirFluig(request);
    if (negado) return negado;
    const envio = db.envios.find((e) => e.id === params.envioId);
    if (!envio) return problema('NAO_ENCONTRADO');
    const corpo = envio.formato === 'application/pdf' ? pdfExemplo(envio.nomeArquivo) : pngExemplo();
    return new HttpResponse(corpo, {
      status: 200,
      headers: {
        'Content-Type': envio.formato === 'application/pdf' ? 'application/pdf' : 'image/png',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(envio.nomeArquivo)}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      },
    });
  }),

  http.post(`${API}/envios/:envioId/aprovar`, async ({ request, params }) => {
    await latencia();
    const negado = exigirFluig(request) ?? exigirAdmin();
    if (negado) return negado;
    const envio = db.envios.find((e) => e.id === params.envioId);
    if (!envio) return problema('NAO_ENCONTRADO');
    if (envio.status !== 'EM_ANALISE') return problema('ENVIO_JA_ANALISADO');
    Object.assign(envio, {
      status: 'APROVADO',
      analisadoEm: agoraIso(),
      analisadoPor: { login: USUARIO_MOCK.login, nome: USUARIO_MOCK.nome },
      motivoRejeicao: null,
    });
    return HttpResponse.json(paraEnvio(envio));
  }),

  http.post(`${API}/envios/:envioId/rejeitar`, async ({ request, params }) => {
    await latencia();
    const negado = exigirFluig(request) ?? exigirAdmin();
    if (negado) return negado;
    const envio = db.envios.find((e) => e.id === params.envioId);
    if (!envio) return problema('NAO_ENCONTRADO');
    const corpo = (await request.json().catch(() => ({}))) as { motivo?: unknown };
    const motivo = typeof corpo.motivo === 'string' ? corpo.motivo.trim() : '';
    if (motivo.length < 5 || motivo.length > 500) {
      return validacao({ motivo: ['Informe o motivo da rejeição (de 5 a 500 caracteres).'] });
    }
    if (envio.status !== 'EM_ANALISE') return problema('ENVIO_JA_ANALISADO');
    Object.assign(envio, {
      status: 'REJEITADO',
      analisadoEm: agoraIso(),
      analisadoPor: { login: USUARIO_MOCK.login, nome: USUARIO_MOCK.nome },
      motivoRejeicao: motivo,
    });
    return HttpResponse.json(paraEnvio(envio));
  }),

  http.get(`${API}/empresas/:empresaId/documentos`, async ({ request, params }) => {
    await latencia();
    const negado = exigirFluig(request);
    if (negado) return negado;
    const empresa = db.empresas.find((e) => e.id === params.empresaId);
    if (!empresa) return problema('NAO_ENCONTRADO');
    return HttpResponse.json(tiposAtivos().map((t) => paraDocumentoSituacao(empresa.id, t)));
  }),

  http.get(`${API}/empresas/:empresaId/documentos/:tipoId/envios`, async ({ request, params }) => {
    await latencia();
    const negado = exigirFluig(request);
    if (negado) return negado;
    const empresa = db.empresas.find((e) => e.id === params.empresaId);
    const tipo = db.tipos.find((t) => t.id === params.tipoId);
    if (!empresa || !tipo) return problema('NAO_ENCONTRADO');
    return HttpResponse.json(enviosDe(empresa.id, tipo.id).map(paraEnvio));
  }),
];
