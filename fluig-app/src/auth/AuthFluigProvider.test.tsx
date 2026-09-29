import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { AuthFluigProvider } from './AuthFluigProvider';
import { useUsuarioFluig } from './contexto';
import { CHAVE_TOKEN } from './tokenFluig';

function Conteudo() {
  const usuario = useUsuarioFluig();
  return <p>Olá, {usuario.nome}</p>;
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

  it('sem token mostra "Abra este sistema pelo Fluig." e nenhum dado', async () => {
    renderizar();
    expect(await screen.findByText('Abra este sistema pelo Fluig.')).toBeInTheDocument();
    expect(screen.queryByText(/Olá/)).not.toBeInTheDocument();
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
});
