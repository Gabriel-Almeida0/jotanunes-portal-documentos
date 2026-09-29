import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CHAVE_TOKEN } from '../auth/armazenamento';
import { conectarComo, EMPRESA_ALFA, renderizarPortal, rotaAtual } from '../test/utils';

describe('Cabecalho', () => {
  it('sem sessão mostra só a marca, sem "Sair"', async () => {
    renderizarPortal('/acesso');
    const banner = await screen.findByRole('banner');
    expect(within(banner).getByRole('img', { name: 'Jotanunes Construtora' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument();
  });

  it('mostra a razão social da empresa conectada e "Sair" encerra a sessão', async () => {
    await conectarComo(EMPRESA_ALFA.cnpj, EMPRESA_ALFA.senha);
    const { user } = renderizarPortal('/documentos');

    const banner = screen.getByRole('banner');
    expect(banner).toHaveTextContent('Alfa Engenharia Ltda');
    expect(banner).toHaveTextContent('CNPJ 11.222.333/0001-81');
    expect(sessionStorage.getItem(CHAVE_TOKEN)).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => expect(rotaAtual()).toBe('/acesso'));
    expect(sessionStorage.getItem(CHAVE_TOKEN)).toBeNull();
    expect(screen.queryByText('Alfa Engenharia Ltda')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Acesse o portal de documentos' }),
    ).toBeInTheDocument();
  });
});
