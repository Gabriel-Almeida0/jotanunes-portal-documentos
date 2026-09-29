import { screen, waitFor, within } from '@testing-library/react';
import { IDS } from '../mocks/dados';
import { renderizarRota } from '../test/renderizar';

describe('Detalhe da obra', () => {
  it('mostra as empresas vinculadas com situação de acesso e documentos', async () => {
    renderizarRota(`/obras/${IDS.obraVistaDoRio}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Residencial Vista do Rio' })).toBeInTheDocument();
    const tabela = screen.getByRole('table', { name: 'Empresas da obra' });
    const alfa = within(tabela).getByText('Alfa Engenharia Ltda').closest('tr')!;
    expect(within(alfa).getByText('11.222.333/0001-81')).toBeInTheDocument();
    expect(within(alfa).getByText('Acesso ativo')).toBeInTheDocument();
    expect(within(alfa).getByText('2 de 4 aprovados')).toBeInTheDocument();
  });

  it('vincula uma empresa e ela aparece na tabela (sem duplicar)', async () => {
    const { usuario } = renderizarRota(`/obras/${IDS.obraFlorDeSal}`);
    await screen.findByRole('heading', { level: 1, name: 'Condomínio Flor de Sal' });
    await usuario.click(screen.getByRole('button', { name: 'Vincular empresa' }));
    const dialogo = screen.getByRole('dialog', { name: 'Vincular empresa à obra' });
    await usuario.type(within(dialogo).getByLabelText('Buscar empresa'), 'gama');
    const item = (await within(dialogo).findByText('Gama Instalações Elétricas Ltda')).closest('li')!;
    await usuario.click(within(item).getByRole('button', { name: /Vincular/ }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const tabela = screen.getByRole('table', { name: 'Empresas da obra' });
    expect(await within(tabela).findByText('Gama Instalações Elétricas Ltda')).toBeInTheDocument();
    expect(within(tabela).getAllByText('Gama Instalações Elétricas Ltda')).toHaveLength(1);
  });

  it('empresa já vinculada aparece como "Já vinculada"', async () => {
    const { usuario } = renderizarRota(`/obras/${IDS.obraFlorDeSal}`);
    await screen.findByRole('heading', { level: 1, name: 'Condomínio Flor de Sal' });
    await usuario.click(screen.getByRole('button', { name: 'Vincular empresa' }));
    const dialogo = screen.getByRole('dialog', { name: 'Vincular empresa à obra' });
    await usuario.type(within(dialogo).getByLabelText('Buscar empresa'), 'alfa');
    const item = (await within(dialogo).findByText('Alfa Engenharia Ltda')).closest('li')!;
    expect(within(item).getByText('Já vinculada')).toBeInTheDocument();
  });

  it('desvincula com confirmação', async () => {
    const { usuario } = renderizarRota(`/obras/${IDS.obraFlorDeSal}`);
    const tabela = await screen.findByRole('table', { name: 'Empresas da obra' });
    const linha = within(tabela).getByText('Delta Pinturas e Acabamentos ME').closest('tr')!;
    await usuario.click(within(linha).getByRole('button', { name: /Desvincular/ }));
    const dialogo = screen.getByRole('dialog', { name: 'Desvincular empresa?' });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Desvincular' }));
    await waitFor(() => expect(screen.queryByText('Delta Pinturas e Acabamentos ME')).not.toBeInTheDocument());
  });

  it('obra inexistente mostra a mensagem de não encontrado', async () => {
    renderizarRota('/obras/99999999-9999-4999-8999-999999999999');
    expect(await screen.findByText('Não encontramos o que você procurou.')).toBeInTheDocument();
  });
});
