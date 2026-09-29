import { http, HttpResponse } from 'msw';
import type { Painel } from '../../api/tipos';
import { contagemDocumentos, db, situacaoAcesso } from '../dados';
import { API, exigirFluig, latencia, problema, sessaoDe } from '../util';

export const handlersSessao = [
  http.get(`${API}/me`, async ({ request }) => {
    await latencia();
    // `/me` responde também com a troca de senha pendente (é por ele que o app descobre a troca).
    const sessao = sessaoDe(request);
    return sessao ? HttpResponse.json(sessao.usuario) : problema('NAO_AUTENTICADO');
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
