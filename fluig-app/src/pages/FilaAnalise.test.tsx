import { screen, waitFor, within } from '@testing-library/react';
import { IDS } from '../mocks/dados';
import { renderizarRota } from '../test/renderizar';

describe('Fila de análise', () => {
  it('mostra os envios em análise do mais antigo para o mais novo', async () => {
    renderizarRota('/analise');
    const tabela = await screen.findByRole('table', { name: 'Envios aguardando análise' });
    const linhas = within(tabela).getAllByRole('row').slice(1);
    const documentos = linhas.map((l) => within(l).getAllByRole('cell')[1].textContent);
    expect(documentos).toEqual(['PCMSO', 'ASO — Atestado de Saúde Ocupacional', 'Cartão CNPJ']);
    expect(within(linhas[0]).getByText('11.222.333/0001-81')).toBeInTheDocument();
  });

  it('aplica o filtro por empresa', async () => {
    const { usuario } = renderizarRota('/analise');
    await screen.findByRole('table', { name: 'Envios aguardando análise' });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Zeta Andaimes e Equipamentos Ltda' })).toBeInTheDocument());
    await usuario.selectOptions(screen.getByLabelText('Empresa'), IDS.empresaZeta);
    await usuario.click(screen.getByRole('button', { name: 'Pesquisar' }));
    await waitFor(() =>
      expect(within(screen.getByRole('table', { name: 'Envios aguardando análise' })).queryByText('PCMSO')).not.toBeInTheDocument(),
    );
    const tabela = screen.getByRole('table', { name: 'Envios aguardando análise' });
    expect(within(tabela).getAllByRole('row')).toHaveLength(3);
    expect(within(tabela).getAllByText('Zeta Andaimes e Equipamentos Ltda')).toHaveLength(2);
  });

  it('mostra o estado vazio quando não há nada para analisar', async () => {
    const { usuario } = renderizarRota('/analise');
    await screen.findByRole('table', { name: 'Envios aguardando análise' });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Gama Instalações Elétricas Ltda' })).toBeInTheDocument());
    await usuario.selectOptions(screen.getByLabelText('Empresa'), IDS.empresaGama);
    await usuario.click(screen.getByRole('button', { name: 'Pesquisar' }));
    expect(await screen.findByText('Nenhum envio encontrado com esses filtros.')).toBeInTheDocument();
  });
});
