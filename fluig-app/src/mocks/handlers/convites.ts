import { http, HttpResponse } from 'msw';
import { USUARIO_MOCK, agora, convitesDaEmpresa, db, novoId, paraConvite, type ConviteDb } from '../dados';
import { API, exigirFluig, latencia, problema } from '../util';

const SETE_DIAS = 7 * 24 * 3_600_000;

export const handlersConvites = [
  http.get(`${API}/empresas/:empresaId/convites`, async ({ request, params }) => {
    await latencia();
    const negado = exigirFluig(request);
    if (negado) return negado;
    const empresa = db.empresas.find((e) => e.id === params.empresaId);
    if (!empresa) return problema('NAO_ENCONTRADO');
    return HttpResponse.json(convitesDaEmpresa(empresa.id).map(paraConvite));
  }),

  /**
   * Cenários: empresa inativa → 409 EMPRESA_INATIVA; e-mail de contato contendo "falha" → 502
   * EMAIL_FALHOU sem gravar nada (como a API real quando o Resend falha).
   */
  http.post(`${API}/empresas/:empresaId/convites`, async ({ request, params }) => {
    await latencia();
    const negado = exigirFluig(request);
    if (negado) return negado;
    const empresa = db.empresas.find((e) => e.id === params.empresaId);
    if (!empresa) return problema('NAO_ENCONTRADO');
    if (!empresa.ativa) return problema('EMPRESA_INATIVA');
    if (empresa.emailContato.includes('falha')) return problema('EMAIL_FALHOU');

    const enviadoEm = agora();
    for (const c of convitesDaEmpresa(empresa.id)) {
      if (!c.usadoEm && !c.substituidoEm) c.substituidoEm = enviadoEm.toISOString();
    }
    const convite: ConviteDb = {
      id: novoId(),
      empresaId: empresa.id,
      emailDestino: empresa.emailContato,
      enviadoEm: enviadoEm.toISOString(),
      expiraEm: new Date(enviadoEm.getTime() + SETE_DIAS).toISOString(),
      usadoEm: null,
      substituidoEm: null,
      enviadoPor: { login: USUARIO_MOCK.login, nome: USUARIO_MOCK.nome },
    };
    db.convites.push(convite);
    empresa.trocaSenhaObrigatoria = true;
    empresa.senhaTemporariaExpiraEm = convite.expiraEm;
    return HttpResponse.json(paraConvite(convite), { status: 201 });
  }),
];
