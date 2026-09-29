import { screen } from '@testing-library/react';
import { CHAVE_TOKEN } from '../auth/tokenFluig';
import { IDS, definirSessaoMock } from '../mocks/dados';
import { renderizarRota } from '../test/renderizar';
import { renderizarApp } from '../test/renderizarApp';

const OBRIGATORIA = 'Crie uma nova senha para continuar.';

type Usuario = ReturnType<typeof renderizarApp>['usuario'];

async function entrarComProvisoria(usuario: Usuario) {
  await screen.findByRole('heading', { level: 1, name: 'Acesse a documentação de terceirizadas' });
  await usuario.type(screen.getByLabelText('Login'), 'novo.mock');
  await usuario.type(screen.getByLabelText('Senha'), 'Temp1234');
  await usuario.click(screen.getByRole('button', { name: 'Acessar' }));
  await screen.findByRole('heading', { level: 1, name: OBRIGATORIA });
}

async function preencher(usuario: Usuario, atual: string, nova: string, confirmacao = nova) {
  await usuario.type(screen.getByLabelText('Senha atual'), atual);
  await usuario.type(screen.getByLabelText('Nova senha'), nova);
  await usuario.type(screen.getByLabelText('Confirme a nova senha'), confirmacao);
}

describe('TrocaSenha', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_FLUIG_DEV_TOKEN', '');
    vi.stubEnv('VITE_USE_MOCKS', 'false');
  });
  afterEach(() => vi.unstubAllEnvs());

  describe('obrigatória (senha provisória)', () => {
    it('login com senha provisória leva à troca e nenhuma rota do app abre', async () => {
      const { usuario, requisicoes } = renderizarApp('/obras');
      await entrarComProvisoria(usuario);

      expect(screen.queryByRole('navigation', { name: 'Menu principal' })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Obras' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
      // As regras ficam visíveis.
      expect(screen.getByText('Pelo menos 8 caracteres')).toBeInTheDocument();
      expect(screen.getByText('Letras e números')).toBeInTheDocument();
      expect(screen.getByText('Diferente da senha atual')).toBeInTheDocument();
      expect(requisicoes.some((r) => r.includes('/api/fluig/obras'))).toBe(false);
    });

    it('recusa senha fraca no cliente, sem chamar a API', async () => {
      const { usuario, requisicoes } = renderizarApp('/');
      await entrarComProvisoria(usuario);
      await preencher(usuario, 'Temp1234', 'abc');
      await usuario.click(screen.getByRole('button', { name: 'Salvar e continuar' }));

      expect(
        screen.getByText('A senha precisa ter pelo menos 8 caracteres, com letras e números.'),
      ).toBeInTheDocument();
      expect(requisicoes.some((r) => r.includes('/auth/trocar-senha'))).toBe(false);
    });

    it('recusa confirmação diferente e nova senha igual à atual no cliente', async () => {
      const { usuario } = renderizarApp('/');
      await entrarComProvisoria(usuario);
      await preencher(usuario, 'Temp1234', 'Nova1234', 'Nova9999');
      await usuario.click(screen.getByRole('button', { name: 'Salvar e continuar' }));
      expect(screen.getByText('As senhas não são iguais.')).toBeInTheDocument();

      await usuario.clear(screen.getByLabelText('Nova senha'));
      await usuario.type(screen.getByLabelText('Nova senha'), 'Temp1234');
      await usuario.click(screen.getByRole('button', { name: 'Salvar e continuar' }));
      expect(screen.getByText('A nova senha precisa ser diferente da atual.')).toBeInTheDocument();
    });

    it('mostra SENHA_ATUAL_INCORRETA no campo da senha atual', async () => {
      const { usuario } = renderizarApp('/');
      await entrarComProvisoria(usuario);
      await preencher(usuario, 'Errada123', 'Nova1234');
      await usuario.click(screen.getByRole('button', { name: 'Salvar e continuar' }));

      expect(await screen.findByText('A senha atual não confere.')).toBeInTheDocument();
      expect(screen.getByLabelText('Senha atual')).toHaveAttribute('aria-invalid', 'true');
    });

    it('sucesso entra no painel com "Senha alterada." e o token novo', async () => {
      const { usuario } = renderizarApp('/obras');
      await entrarComProvisoria(usuario);
      const tokenProvisorio = window.sessionStorage.getItem(CHAVE_TOKEN);
      await preencher(usuario, 'Temp1234', 'Nova1234');
      await usuario.click(screen.getByRole('button', { name: 'Salvar e continuar' }));

      expect(await screen.findByRole('heading', { level: 1, name: 'Painel' })).toBeInTheDocument();
      expect(await screen.findByText('Senha alterada.')).toBeInTheDocument();
      expect(screen.getByText(/Olá, Nina!/)).toBeInTheDocument();
      expect(window.sessionStorage.getItem(CHAVE_TOKEN)).not.toBe(tokenProvisorio);
      expect(window.location.hash).toBe('#/');
    });

    it('"Sair" na troca obrigatória volta ao login', async () => {
      const { usuario } = renderizarApp('/');
      await entrarComProvisoria(usuario);
      await usuario.click(screen.getByRole('button', { name: 'Sair' }));
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Acesse a documentação de terceirizadas' }),
      ).toBeInTheDocument();
      expect(window.sessionStorage.getItem(CHAVE_TOKEN)).toBeNull();
    });
  });

  describe('voluntária ("Trocar senha" no menu)', () => {
    it('abre com "Cancelar", que volta ao painel', async () => {
      definirSessaoMock({ origem: 'LOGIN_LOCAL' });
      const { usuario, local } = renderizarRota('/trocar-senha');
      expect(await screen.findByRole('heading', { level: 1, name: 'Trocar senha' })).toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: 'Menu principal' })).toBeInTheDocument();
      await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(local()).toBe('/');
    });

    it('troca a senha e volta ao painel com "Senha alterada."', async () => {
      window.sessionStorage.setItem(CHAVE_TOKEN, `local:${IDS.usuarioAdmin}:0`);
      const { usuario } = renderizarApp('/trocar-senha');
      await screen.findByRole('heading', { level: 1, name: 'Trocar senha' });
      await preencher(usuario, 'Admin1234', 'Outra1234');
      await usuario.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

      expect(await screen.findByRole('heading', { level: 1, name: 'Painel' })).toBeInTheDocument();
      expect(await screen.findByText('Senha alterada.')).toBeInTheDocument();
    });

    it('com sessão do Fluig, /trocar-senha redireciona ao painel', async () => {
      const { local } = renderizarRota('/trocar-senha');
      expect(await screen.findByRole('heading', { level: 1, name: 'Painel' })).toBeInTheDocument();
      expect(local()).toBe('/');
    });
  });
});
