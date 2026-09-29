import { screen, within } from '@testing-library/react';
import { CHAVE_TOKEN } from '../auth/tokenFluig';
import { IDS, db, definirPerfilMock, definirSessaoMock } from '../mocks/dados';
import { renderizarRota } from '../test/renderizar';
import { renderizarApp } from '../test/renderizarApp';

function menu() {
  return screen.getByRole('navigation', { name: 'Menu principal' });
}

describe('Layout — menu por perfil e origem da sessão', () => {
  it('administrador do login próprio vê "Usuários", "Trocar senha" e "Sair"', async () => {
    definirSessaoMock({ origem: 'LOGIN_LOCAL' });
    renderizarRota('/');
    await screen.findByRole('heading', { level: 1, name: 'Painel' });
    expect(within(menu()).getByRole('link', { name: 'Usuários' })).toHaveAttribute('href', '/usuarios');
    expect(within(menu()).getByRole('link', { name: 'Trocar senha' })).toHaveAttribute('href', '/trocar-senha');
    expect(within(menu()).getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });

  it('usuário comum do login próprio não vê "Usuários", mas vê "Trocar senha" e "Sair"', async () => {
    definirSessaoMock({ origem: 'LOGIN_LOCAL', perfil: 'comum' });
    renderizarRota('/');
    await screen.findByRole('heading', { level: 1, name: 'Painel' });
    expect(within(menu()).queryByRole('link', { name: 'Usuários' })).not.toBeInTheDocument();
    expect(within(menu()).getByRole('link', { name: 'Trocar senha' })).toBeInTheDocument();
    expect(within(menu()).getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });

  it('administrador do Fluig vê "Usuários" e não vê "Sair" nem "Trocar senha"', async () => {
    renderizarRota('/');
    await screen.findByRole('heading', { level: 1, name: 'Painel' });
    expect(within(menu()).getByRole('link', { name: 'Usuários' })).toBeInTheDocument();
    expect(within(menu()).queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument();
    expect(within(menu()).queryByRole('link', { name: 'Trocar senha' })).not.toBeInTheDocument();
  });

  it('usuário comum do Fluig não vê "Usuários", "Sair" nem "Trocar senha"', async () => {
    definirPerfilMock('comum');
    renderizarRota('/');
    await screen.findByRole('heading', { level: 1, name: 'Painel' });
    expect(within(menu()).queryByRole('link', { name: 'Usuários' })).not.toBeInTheDocument();
    expect(within(menu()).queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument();
  });

  it('"Sair" chama POST /api/fluig/auth/sair, limpa o sessionStorage e mostra o login', async () => {
    window.sessionStorage.setItem(CHAVE_TOKEN, `local:${IDS.usuarioComum}:0`);
    const { usuario, requisicoes } = renderizarApp('/obras');
    await screen.findByRole('heading', { level: 1, name: 'Obras' });

    await usuario.click(within(menu()).getByRole('button', { name: 'Sair' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Acesse a documentação de terceirizadas' }),
    ).toBeInTheDocument();
    expect(requisicoes).toContain('POST /api/fluig/auth/sair');
    expect(window.sessionStorage.getItem(CHAVE_TOKEN)).toBeNull();
    // A sessão deixou de valer na API (versão da credencial subiu).
    expect(db.usuarios.find((u) => u.id === IDS.usuarioComum)?.versao).toBe(1);
    expect(screen.queryByText('Sua sessão expirou. Entre de novo.')).not.toBeInTheDocument();
  });
});
