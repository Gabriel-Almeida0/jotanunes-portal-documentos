import { screen, waitFor, within } from '@testing-library/react';
import { renderizarRota } from '../test/renderizar';

describe('Obras', () => {
  it('lista as obras ativas com quantidade de empresas', async () => {
    renderizarRota('/obras');
    const tabela = await screen.findByRole('table', { name: 'Obras' });
    const linha = within(tabela).getByText('Residencial Vista do Rio').closest('tr')!;
    expect(within(linha).getByText('3')).toBeInTheDocument();
    expect(within(tabela).queryByText('Parque das Palmeiras')).not.toBeInTheDocument();
  });

  it('filtra por busca pelo padrão de filtros', async () => {
    const { usuario } = renderizarRota('/obras');
    await screen.findByRole('table', { name: 'Obras' });
    await usuario.type(screen.getByLabelText('Buscar'), 'flor');
    await usuario.click(screen.getByRole('button', { name: 'Pesquisar' }));
    await waitFor(() => expect(screen.queryByText('Residencial Vista do Rio')).not.toBeInTheDocument());
    expect(screen.getByText('Condomínio Flor de Sal')).toBeInTheDocument();
  });

  it('cria uma obra e abre o detalhe dela', async () => {
    const { usuario } = renderizarRota('/obras');
    await screen.findByRole('table', { name: 'Obras' });
    await usuario.click(screen.getByRole('button', { name: 'Nova obra' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nova obra' });
    await usuario.type(within(dialogo).getByLabelText(/Nome da obra/), 'Residencial Mar Azul');
    await usuario.type(within(dialogo).getByLabelText(/Cidade/), 'Aracaju');
    await usuario.selectOptions(within(dialogo).getByLabelText(/UF/), 'SE');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Residencial Mar Azul' })).toBeInTheDocument();
    expect(screen.getByText('Nenhuma empresa vinculada a esta obra.')).toBeInTheDocument();
  });

  it('valida os campos obrigatórios no cliente', async () => {
    const { usuario } = renderizarRota('/obras');
    await screen.findByRole('table', { name: 'Obras' });
    await usuario.click(screen.getByRole('button', { name: 'Nova obra' }));
    const dialogo = screen.getByRole('dialog', { name: 'Nova obra' });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    expect(within(dialogo).getByText('Informe o nome da obra (de 3 a 150 caracteres).')).toBeInTheDocument();
    expect(within(dialogo).getByText('Escolha a UF.')).toBeInTheDocument();
  });
});
