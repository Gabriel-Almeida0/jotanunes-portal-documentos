import { http, HttpResponse } from 'msw';
import type { Painel } from '../../api/tipos';
import { contagemDocumentos, db, situacaoAcesso, usuarioMock } from '../dados';
import { API, exigirFluig, latencia } from '../util';

export const handlersSessao = [
  http.get(`${API}/me`, async ({ request }) => {
    await latencia();
    return exigirFluig(request) ?? HttpResponse.json(usuarioMock());
  }),

  http.get(`${API}/painel`, async ({ request }) => {
    await latencia();
    const negado = exigirFluig(request);
    if (negado) return negado;
    const ativas = db.empresas.filter((e) => e.ativa);
    const painel: Painel = {
      enviosEmAnalise: db.envios.filter((e) => e.status === 'EM_ANALISE').length,
      empresasComPendencia: ativas.filter((e) => {
        const c = contagemDocumentos(e.id);
        return c.pendentes + c.rejeitados > 0;
      }).length,
      empresasConvidadasSemAcesso: db.empresas.filter((e) => {
        const s = situacaoAcesso(e);
        return s === 'CONVIDADA' || s === 'CONVITE_EXPIRADO';
      }).length,
      empresasAtivas: ativas.length,
      obrasAtivas: db.obras.filter((o) => o.ativa).length,
    };
    return HttpResponse.json(painel);
  }),
];
