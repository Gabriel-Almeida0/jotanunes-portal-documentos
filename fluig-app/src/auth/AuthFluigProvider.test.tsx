import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import App from '../App';
import { api } from '../api/fluig';
import { IDS, definirLoginLocalMock } from '../mocks/dados';
import { AuthFluigProvider } from './AuthFluigProvider';
import { useUsuarioFluig } from './contexto';
import { CHAVE_TOKEN } from './tokenFluig';

const TOKEN_LOCAL_COMUM = `local:${IDS.usuarioComum}:0`;
const TITULO_LOGIN = 'Acesse a documentação de terceirizadas';

function Conteudo() {
  const usuario = useUsuarioFluig();
  return (
    <>
      <p>Olá, {usuario.nome}</p>
      <p>Origem: {usuario.origem}</p>
      <button type="button" onClick={() => void api.painel().catch(() => undefined)}>
        Carregar painel
      </button>
    </>
  );
}

function renderizar() {
  return render(
    <AuthFluigProvider>
      <Conteudo />
    </AuthFluigProvider>,
  );
}

describe('AuthFluigProvider', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_FLUIG_DEV_TOKEN', '');
    vi.stubEnv('VITE_USE_MOCKS', 'false');
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('usa o token do fragmento, envia como Bearer e remove o token da URL', async () => {
    let autorizacao: string | null = null;
    server.use(
      http.get('*/api/fluig/me', ({ request }) => {
        autorizacao = request.headers.get('authorization');
        return HttpResponse.json({ login: 'maria.silva', nome: 'Maria Silva', email: 'maria@jotanunes.com' });
      }),
    );
    window.history.replaceState(null, '', '/#fluigToken=token-do-fluig');

    renderizar();

    expect(await screen.findByText('Olá, Maria Silva')).toBeInTheDocument();
    expect(autorizacao).toBe('Bearer token-do-fluig');
    expect(window.location.hash).not.toContain('fluigToken');
    expect(window.location.href).not.toContain('token-do-fluig');
    expect(window.sessionStorage.getItem(CHAVE_TOKEN)).toBe('token-do-fluig');
  });

  it('sem token e com o login próprio ligado mostra a tela de login e nenhum dado', async () => {
    renderizar();
    expect(await screen.findByRole('heading', { level: 1, name: TITULO_LOGIN })).toBeInTheDocument();
    expect(screen.getByLabelText('Login')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Acessar' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Jotanunes Construtora' })).toBeInTheDocument();
    expect(screen.queryByText(/Olá/)).not.toBeInTheDocument();
    expect(screen.queryByText('Abra este sistema pelo Fluig.')).not.toBeInTheDocument();
  });

  it('sem token e com o login próprio desligado mostra "Abra este sistema pelo Fluig." e nenhum dado', async () => {
    definirLoginLocalMock(false);
    renderizar();
    expect(await screen.findByText('Abra este sistema pelo Fluig.')).toBeInTheDocument();
    expect(screen.queryByText(/Olá/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument();
  });

  it('sem token e sem resposta da configuração mostra o erro com "Tentar de novo"', async () => {
    server.use(http.get('*/api/fluig/auth/configuracao', () => HttpResponse.error()));
    renderizar();
    const tentar = await screen.findByRole('button', { name: 'Tentar de novo' });
    server.resetHandlers();
    await userEvent.click(tentar);
    expect(await screen.findByRole('heading', { level: 1, name: TITULO_LOGIN })).toBeInTheDocument();
  });

  it('token do Fluig no fragmento abre o app sem "Sair" nem "Trocar senha"', async () => {
    window.history.replaceState(null, '', '/#fluigToken=token-do-fluig');
    render(
      <AuthFluigProvider>
        <App />
      </AuthFluigProvider>,
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Painel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Trocar senha' })).not.toBeInTheDocument();
  });

  it('401 numa sessão de login próprio volta para o login com "Sua sessão expirou. Entre de novo."', async () => {
    window.sessionStorage.setItem(CHAVE_TOKEN, TOKEN_LOCAL_COMUM);
    renderizar();
    expect(await screen.findByText('Origem: LOGIN_LOCAL')).toBeInTheDocument();
    server.use(
      http.get('*/api/fluig/painel', () =>
        HttpResponse.json({ code: 'NAO_AUTENTICADO', status: 401, title: 'Sua sessão expirou. Entre de novo.', type: 'x' }, { status: 401 }),
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Carregar painel' }));

    expect(await screen.findByRole('heading', { level: 1, name: TITULO_LOGIN })).toBeInTheDocument();
    expect(screen.getByText('Sua sessão expirou. Entre de novo.')).toBeInTheDocument();
    expect(screen.queryByText(/Olá/)).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem(CHAVE_TOKEN)).toBeNull();
  });

  it('401 numa sessão do Fluig mostra "Abra este sistema pelo Fluig." mesmo com o login próprio ligado', async () => {
    window.sessionStorage.setItem(CHAVE_TOKEN, 'token-valido');
    renderizar();
    expect(await screen.findByText('Origem: FLUIG')).toBeInTheDocument();
    server.use(
      http.get('*/api/fluig/painel', () =>
        HttpResponse.json({ code: 'NAO_AUTENTICADO', status: 401, title: 'x', type: 'x' }, { status: 401 }),
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Carregar painel' }));

    expect(await screen.findByText('Abra este sistema pelo Fluig.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem(CHAVE_TOKEN)).toBeNull();
  });

  it('401 do /me mostra a mesma tela e descarta o token', async () => {
    window.history.replaceState(null, '', '/#fluigToken=expirado');
    renderizar();
    expect(await screen.findByText('Abra este sistema pelo Fluig.')).toBeInTheDocument();
    expect(screen.queryByText(/Olá/)).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem(CHAVE_TOKEN)).toBeNull();
  });

  it('reaproveita o token guardado na sessão e mostra o nome do usuário', async () => {
    window.sessionStorage.setItem(CHAVE_TOKEN, 'token-valido');
    renderizar();
    expect(await screen.findByText('Olá, Analista Dev')).toBeInTheDocument();
  });

  it('em desenvolvimento usa VITE_FLUIG_DEV_TOKEN quando não há outro token', async () => {
    vi.stubEnv('VITE_FLUIG_DEV_TOKEN', 'token-dev');
    renderizar();
    expect(await screen.findByText('Olá, Analista Dev')).toBeInTheDocument();
  });

  describe('token entregue trocando só o fragmento (sem recarregar)', () => {
    /** Simula o Fluig trocando o fragmento no mesmo iframe (navegação de fragmento real do jsdom). */
    function fluigTrocaFragmento(fragmento: string) {
      act(() => {
        window.location.hash = fragmento;
      });
    }

    function espiarAutorizacao() {
      const autorizacoes: (string | null)[] = [];
      server.events.on('request:start', ({ request }) => {
        if (request.url.endsWith('/api/fluig/me')) autorizacoes.push(request.headers.get('authorization'));
      });
      return autorizacoes;
    }

    afterEach(() => {
      server.events.removeAllListeners();
    });

    it('sai de "Abra este sistema pelo Fluig." quando o token chega pelo hashchange e limpa a URL', async () => {
      definirLoginLocalMock(false);
      const autorizacoes = espiarAutorizacao();
      const tamanhoInicial = window.history.length;
      renderizar();
      expect(await screen.findByText('Abra este sistema pelo Fluig.')).toBeInTheDocument();

      fluigTrocaFragmento('#fluigToken=token-chegou-depois');

      expect(await screen.findByText('Olá, Analista Dev')).toBeInTheDocument();
      expect(autorizacoes).toContain('Bearer token-chegou-depois');
      expect(window.location.href).not.toContain('token-chegou-depois');
      expect(window.location.hash).toBe('#/');
      expect(window.sessionStorage.getItem(CHAVE_TOKEN)).toBe('token-chegou-depois');
      // A entrada criada pela troca de fragmento foi substituída (sem token), não duplicada.
      expect(window.history.length).toBe(tamanhoInicial + 1);
    });

    it('renova o token com o app aberto sem perder a rota nem desmontar a tela', async () => {
      window.sessionStorage.setItem(CHAVE_TOKEN, 'token-antigo');
      window.history.replaceState(null, '', '/#/obras');
      const autorizacoes = espiarAutorizacao();
      render(
        <AuthFluigProvider>
          <App />
        </AuthFluigProvider>,
      );
      const titulo = await screen.findByRole('heading', { level: 1, name: 'Obras' });
      expect(autorizacoes).toEqual(['Bearer token-antigo']);

      fluigTrocaFragmento('#fluigToken=token-renovado');

      await waitFor(() => expect(autorizacoes).toEqual(['Bearer token-antigo', 'Bearer token-renovado']));
      await waitFor(() => expect(window.location.hash).toBe('#/obras'));
      expect(window.location.href).not.toContain('token-renovado');
      expect(window.sessionStorage.getItem(CHAVE_TOKEN)).toBe('token-renovado');
      // Mesma tela (mesmo elemento): não voltou para "Conferindo seu acesso…" nem para outra rota.
      expect(screen.getByRole('heading', { level: 1, name: 'Obras' })).toBe(titulo);
      expect(screen.queryByText('Conferindo seu acesso…')).not.toBeInTheDocument();
    });

    it('token junto com uma rota no fragmento abre essa rota', async () => {
      definirLoginLocalMock(false);
      render(
        <AuthFluigProvider>
          <App />
        </AuthFluigProvider>,
      );
      expect(await screen.findByText('Abra este sistema pelo Fluig.')).toBeInTheDocument();

      fluigTrocaFragmento('#/obras?fluigToken=token-com-rota');

      expect(await screen.findByRole('heading', { level: 1, name: 'Obras' })).toBeInTheDocument();
      expect(window.location.hash).toBe('#/obras');
      expect(window.location.href).not.toContain('token-com-rota');
    });

    it('sai da tela de login quando o token do Fluig chega pelo hashchange', async () => {
      renderizar();
      expect(await screen.findByRole('heading', { level: 1, name: TITULO_LOGIN })).toBeInTheDocument();

      fluigTrocaFragmento('#fluigToken=token-chegou-depois');

      expect(await screen.findByText('Olá, Analista Dev')).toBeInTheDocument();
      expect(screen.getByText('Origem: FLUIG')).toBeInTheDocument();
      expect(window.location.href).not.toContain('token-chegou-depois');
    });

    it('o token do fragmento substitui uma sessão de login próprio na mesma aba', async () => {
      window.sessionStorage.setItem(CHAVE_TOKEN, TOKEN_LOCAL_COMUM);
      renderizar();
      expect(await screen.findByText('Olá, Carlos Comum')).toBeInTheDocument();
      expect(screen.getByText('Origem: LOGIN_LOCAL')).toBeInTheDocument();

      fluigTrocaFragmento('#fluigToken=token-do-fluig');

      expect(await screen.findByText('Olá, Analista Dev')).toBeInTheDocument();
      expect(screen.getByText('Origem: FLUIG')).toBeInTheDocument();
      expect(window.sessionStorage.getItem(CHAVE_TOKEN)).toBe('token-do-fluig');
    });

    it('token novo recusado (401) volta para "Abra este sistema pelo Fluig."', async () => {
      window.sessionStorage.setItem(CHAVE_TOKEN, 'token-valido');
      renderizar();
      expect(await screen.findByText('Olá, Analista Dev')).toBeInTheDocument();

      fluigTrocaFragmento('#fluigToken=expirado');

      expect(await screen.findByText('Abra este sistema pelo Fluig.')).toBeInTheDocument();
      expect(window.location.href).not.toContain('expirado');
      expect(window.sessionStorage.getItem(CHAVE_TOKEN)).toBeNull();
    });
  });
});
