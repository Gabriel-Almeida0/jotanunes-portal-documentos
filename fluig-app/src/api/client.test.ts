import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { ErroApi, EVENTO_NAO_AUTENTICADO, definirTokenFluig, mensagemDeErro, requisicao } from './client';
import { MENSAGENS_ERRO, STATUS_ERRO } from './mensagens';

const TITULO_SEM_PERMISSAO = 'Só administradores podem fazer isso. Se você precisa, fale com a TI.';

describe('client — 403 SEM_PERMISSAO', () => {
  beforeEach(() => definirTokenFluig('token-de-teste'));

  it('tem a mensagem e o status do contrato para SEM_PERMISSAO', () => {
    expect(MENSAGENS_ERRO.SEM_PERMISSAO).toBe(TITULO_SEM_PERMISSAO);
    expect(STATUS_ERRO.SEM_PERMISSAO).toBe(403);
  });

  it('converte o problem+json em ErroApi exibível sem derrubar a sessão', async () => {
    server.use(
      http.post('*/api/fluig/tipos-documento', () =>
        HttpResponse.json(
          { type: 'https://jotanunes.com/problemas/sem-permissao', title: TITULO_SEM_PERMISSAO, status: 403, code: 'SEM_PERMISSAO' },
          { status: 403, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    );
    const naoAutenticado = vi.fn();
    window.addEventListener(EVENTO_NAO_AUTENTICADO, naoAutenticado);
    try {
      const erro = await requisicao('POST', '/api/fluig/tipos-documento', { corpo: { nome: 'X' } }).catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroApi);
      expect((erro as ErroApi).status).toBe(403);
      expect((erro as ErroApi).code).toBe('SEM_PERMISSAO');
      expect(mensagemDeErro(erro)).toBe(TITULO_SEM_PERMISSAO);
      expect(naoAutenticado).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(EVENTO_NAO_AUTENTICADO, naoAutenticado);
    }
  });

  it('403 sem corpo vira SEM_PERMISSAO com a mensagem padrão', async () => {
    server.use(http.put('*/api/fluig/obras/:id', () => new HttpResponse(null, { status: 403 })));
    const erro = (await requisicao('PUT', '/api/fluig/obras/1', { corpo: {} }).catch((e: unknown) => e)) as ErroApi;
    expect(erro.code).toBe('SEM_PERMISSAO');
    expect(erro.title).toBe(TITULO_SEM_PERMISSAO);
  });
});
