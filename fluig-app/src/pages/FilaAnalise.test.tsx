import { screen, waitFor, within } from '@testing-library/react';
import { DATA_FIXA_TESTES, IDS, fixarRelogioMock, reiniciarDados } from '../mocks/dados';
import { renderizarRota } from '../test/renderizar';

describe('Fila de análise', () => {
  beforeEach(() => {
    fixarRelogioMock(DATA_FIXA_TESTES);
    reiniciarDados();
  });

  it('mostra os envios em análise do mais antigo para o mais novo', async () => {
    renderizarRota('/analise');
    const tabela = await screen.findByRole('table', { name: 'Envios aguardando análise' });
    const linhas = within(tabela).getAllByRole('row').slice(1);
    const documentos = linhas.map((l) => within(l).getAllByRole('cell')[1].textContent);
    expect(documentos).toEqual([
      'Guia do FGTSAgosto/2026Com atraso',
      'PCMSO',
      'ASO — Atestado de Saúde Ocupacional',
      'ART da obra',
      'Cartão CNPJ',
      'Guia do FGTSOutubro/2026',
    ]);
    expect(within(linhas[0]).getByText('11.222.333/0001-81')).toBeInTheDocument();
  });

  it('mostra a obra de cada envio ou "Geral da empresa"', async () => {
    renderizarRota('/analise');
    const tabela = await screen.findByRole('table', { name: 'Envios aguardando análise' });
    expect(within(tabela).getByRole('columnheader', { name: 'Obra' })).toBeInTheDocument();
    const art = within(tabela).getByText('ART da obra').closest('tr')!;
    expect(within(art).getByText('Condomínio Flor de Sal')).toBeInTheDocument();
    const pcmso = within(tabela).getByText('PCMSO').closest('tr')!;
    expect(within(pcmso).getByText('Geral da empresa')).toBeInTheDocument();
  });

  it('filtra pelos envios de uma obra', async () => {
    const { usuario, local } = renderizarRota('/analise');
    await screen.findByRole('table', { name: 'Envios aguardando análise' });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Condomínio Flor de Sal' })).toBeInTheDocument());
    await usuario.selectOptions(screen.getByLabelText('Obra'), IDS.obraFlorDeSal);
    await usuario.click(screen.getByRole('button', { name: 'Pesquisar' }));
    await waitFor(() =>
      expect(within(screen.getByRole('table', { name: 'Envios aguardando análise' })).queryByText('PCMSO')).not.toBeInTheDocument(),
    );
    const tabela = screen.getByRole('table', { name: 'Envios aguardando análise' });
    expect(within(tabela).getAllByRole('row')).toHaveLength(2);
    expect(within(tabela).getByText('ART da obra')).toBeInTheDocument();
    expect(local()).toBe(`/analise?obraId=${IDS.obraFlorDeSal}`);
  });

  it('filtra "Somente gerais"', async () => {
    const { usuario, local } = renderizarRota('/analise');
    await screen.findByRole('table', { name: 'Envios aguardando análise' });
    await usuario.selectOptions(screen.getByLabelText('Obra'), 'Somente gerais');
    await usuario.click(screen.getByRole('button', { name: 'Pesquisar' }));
    await waitFor(() =>
      expect(within(screen.getByRole('table', { name: 'Envios aguardando análise' })).queryByText('ART da obra')).not.toBeInTheDocument(),
    );
    const tabela = screen.getByRole('table', { name: 'Envios aguardando análise' });
    expect(within(tabela).getAllByRole('row')).toHaveLength(6);
    expect(local()).toBe('/analise?somenteGerais=true');
    expect(screen.getByLabelText('Obra')).toHaveValue('__gerais');
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
    expect(within(tabela).getAllByRole('row')).toHaveLength(4);
    expect(within(tabela).getAllByText('Zeta Andaimes e Equipamentos Ltda')).toHaveLength(3);
  });

  it('mostra o estado vazio quando não há nada para analisar', async () => {
    const { usuario } = renderizarRota('/analise');
    await screen.findByRole('table', { name: 'Envios aguardando análise' });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Gama Instalações Elétricas Ltda' })).toBeInTheDocument());
    await usuario.selectOptions(screen.getByLabelText('Empresa'), IDS.empresaGama);
    await usuario.click(screen.getByRole('button', { name: 'Pesquisar' }));
    expect(await screen.findByText('Nenhum envio encontrado com esses filtros.')).toBeInTheDocument();
  });

  it('mostra o período ao lado do documento e filtra "Com atraso" (003)', async () => {
    const { usuario, local } = renderizarRota('/analise');
    const tabela = await screen.findByRole('table', { name: 'Envios aguardando análise' });
    const agosto = within(tabela).getByText('Agosto/2026').closest('tr')!;
    expect(within(agosto).getByText('Guia do FGTS')).toBeInTheDocument();
    expect(within(agosto).getByText('Com atraso')).toBeInTheDocument();
    expect(within(agosto).getByRole('link', { name: /Analisar Guia do FGTS de Agosto\/2026 de Alfa/ })).toBeInTheDocument();

    await usuario.click(screen.getByRole('checkbox', { name: 'Com atraso' }));
    await usuario.click(screen.getByRole('button', { name: 'Pesquisar' }));
    await waitFor(() =>
      expect(within(screen.getByRole('table', { name: 'Envios aguardando análise' })).queryByText('PCMSO')).not.toBeInTheDocument(),
    );
    expect(within(screen.getByRole('table', { name: 'Envios aguardando análise' })).getAllByRole('row')).toHaveLength(2);
    expect(local()).toBe('/analise?comAtraso=true');
  });
});
