import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { CHAVE_TOKEN } from '../auth/tokenFluig';
import { server } from '../mocks/server';
import { renderizarApp } from '../test/renderizarApp';

const TITULO = 'Acesse a documentação de terceirizadas';

async function abrirLogin() {
  const r = renderizarApp('/');
  await screen.findByRole('heading', { level: 1, name: TITULO });
  return r;
}

async function entrar(usuario: ReturnType<typeof renderizarApp>['usuario'], login: string, senha: string) {
  await usuario.type(screen.getByLabelText('Login'), login);
  await usuario.type(screen.getByLabelText('Senha'), senha);
  await usuario.click(screen.getByRole('button', { name: 'Acessar' }));
}

function problema(code: string, status: number, title: string, extras: Record<string, unknown> = {}) {
  return HttpResponse.json(
    { type: 'x', code, status, title, ...extras },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

describe('Login (login próprio da área Jotanunes)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_FLUIG_DEV_TOKEN', '');
    vi.stubEnv('VITE_USE_MOCKS', 'false');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('tem os campos com autocomplete, o botão "Acessar", o logo no painel e a ajuda de senha esquecida', async () => {
    await abrirLogin();
    expect(screen.getByLabelText('Login')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Senha')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('img', { name: 'Jotanunes Construtora' })).toBeInTheDocument();
    expect(
      screen.getByText('Esqueceu a senha? Peça a um administrador do sistema para gerar uma nova.'),
    ).toBeInTheDocument();
    // Sem menu nem dados antes de entrar.
    expect(screen.queryByRole('navigation', { name: 'Menu principal' })).not.toBeInTheDocument();
  });

  it('entra com login e senha, vai ao painel com o nome e guarda o token no sessionStorage', async () => {
    const { usuario } = await abrirLogin();
    await entrar(usuario, 'admin.mock', 'Admin1234');

    expect(await screen.findByRole('heading', { level: 1, name: 'Painel' })).toBeInTheDocument();
    expect(screen.getByText(/Olá, Ana!/)).toBeInTheDocument();
    expect(window.sessionStorage.getItem(CHAVE_TOKEN)).toMatch(/^local:/);
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });

  it('campos vazios são validados no cliente, sem chamar a API', async () => {
    const { usuario, requisicoes } = await abrirLogin();
    await usuario.click(screen.getByRole('button', { name: 'Acessar' }));

    expect(screen.getByText('Informe o login.')).toBeInTheDocument();
    expect(screen.getByText('Informe a senha.')).toBeInTheDocument();
    expect(screen.getByLabelText('Login')).toHaveFocus();
    expect(requisicoes.filter((r) => r.includes('/auth/login'))).toEqual([]);
  });

  it('senha errada mostra "Login ou senha incorretos." e limpa a senha', async () => {
    const { usuario } = await abrirLogin();
    await entrar(usuario, 'admin.mock', 'Errada123');

    expect(await screen.findByRole('alert')).toHaveTextContent('Login ou senha incorretos.');
    expect(screen.getByLabelText('Senha')).toHaveValue('');
    expect(screen.getByLabelText('Login')).toHaveValue('admin.mock');
  });

  it('bloqueio mostra o horário de liberação no fuso de São Paulo', async () => {
    server.use(
      http.post('*/api/fluig/auth/login', () =>
        problema('ACESSO_BLOQUEADO', 423, 'Muitas tentativas. Tente de novo em 15 minutos.', {
          bloqueadoAte: '2026-09-29T18:15:00Z',
        }),
      ),
    );
    const { usuario } = await abrirLogin();
    await entrar(usuario, 'admin.mock', 'Errada123');

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Muitas tentativas.');
    expect(alerta).toHaveTextContent('15:15');
  });

  it('6ª tentativa seguida (mock) fica bloqueada', async () => {
    const { usuario } = await abrirLogin();
    for (let i = 0; i < 5; i += 1) {
      await usuario.clear(screen.getByLabelText('Login'));
      await entrar(usuario, 'nao.existe', 'Errada123');
      expect(await screen.findByRole('alert')).toHaveTextContent('Login ou senha incorretos.');
    }
    await usuario.clear(screen.getByLabelText('Login'));
    await entrar(usuario, 'nao.existe', 'Errada123');
    expect(await screen.findByText(/Tente de novo às \d{2}:\d{2}/)).toBeInTheDocument();
  });

  it('usuário desativado e senha provisória expirada mostram as mensagens do contrato', async () => {
    const { usuario } = await abrirLogin();
    await entrar(usuario, 'inativo.mock', 'Inativo1234');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este usuário está desativado. Fale com um administrador do sistema.',
    );

    await usuario.clear(screen.getByLabelText('Login'));
    await usuario.clear(screen.getByLabelText('Senha'));
    await entrar(usuario, 'expirado.mock', 'Temp1234');
    expect(
      await screen.findByText('Sua senha provisória expirou. Peça a um administrador para gerar outra.'),
    ).toBeInTheDocument();
  });

  it('erro de validação da API aparece no campo', async () => {
    server.use(
      http.post('*/api/fluig/auth/login', () =>
        problema('VALIDACAO', 400, 'Confira os dados informados.', { errors: { login: ['Login grande demais.'] } }),
      ),
    );
    const { usuario } = await abrirLogin();
    await entrar(usuario, 'admin.mock', 'Admin1234');
    const campo = screen.getByLabelText('Login');
    expect(await screen.findByText('Login grande demais.')).toBeInTheDocument();
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(within(screen.getByRole('alert')).getByText('Confira os dados informados.')).toBeInTheDocument();
  });

  it('limite de requisições mostra a mensagem do contrato', async () => {
    server.use(
      http.post('*/api/fluig/auth/login', () => problema('LIMITE_REQUISICOES', 429, 'Muitas tentativas. Aguarde um pouco.')),
    );
    const { usuario } = await abrirLogin();
    await entrar(usuario, 'admin.mock', 'Admin1234');
    expect(await screen.findByRole('alert')).toHaveTextContent('Muitas tentativas. Aguarde um pouco.');
  });
});
