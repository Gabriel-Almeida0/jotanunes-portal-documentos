import { http, HttpResponse } from 'msw';
import type { Painel } from '../../api/tipos';
import { db, obraTemPendencia, situacaoAcesso, temAtraso, temPendencia } from '../dados';
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
      // Gerais ou da obra (vínculo ativo em obra ativa) — data-model §5.
      empresasComPendencia: ativas.filter(temPendencia).length,
      obrasComPendencia: db.obras.filter(obraTemPendencia).length,
      // 003 (FR-322): algum período atrasado, geral ou da obra.
      empresasComAtraso: ativas.filter(temAtraso).length,
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
