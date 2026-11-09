import { screen, waitFor, within } from '@testing-library/react';
import { renderizarRota } from '../test/renderizar';

describe('Tipos de documento', () => {
  it('lista os tipos com situação em texto', async () => {
    renderizarRota('/tipos-documento');
    const tabela = await screen.findByRole('table', { name: 'Tipos de documento' });
    expect(within(tabela).getByText('Cartão CNPJ')).toBeInTheDocument();
    expect(within(tabela).getByText('Alvará de funcionamento (antigo)')).toBeInTheDocument();
    expect(within(tabela).getAllByText('Ativo').length).toBeGreaterThan(0);
    expect(within(tabela).getByText('Inativo')).toBeInTheDocument();
  });

  it('cria um tipo e mostra na lista', async () => {
    const { usuario } = renderizarRota('/tipos-documento');
    await screen.findByRole('table', { name: 'Tipos de documento' });
    await usuario.click(screen.getByRole('button', { name: 'Novo tipo de documento' }));
    const dialogo = screen.getByRole('dialog', { name: 'Novo tipo de documento' });
    await usuario.type(within(dialogo).getByLabelText(/Nome/), 'NR-35 — Trabalho em altura');
    await usuario.type(within(dialogo).getByLabelText(/Instruções/), 'Certificado do treinamento de cada trabalhador.');
    await usuario.click(within(dialogo).getByRole('radio', { name: /Geral da empresa/ }));
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('NR-35 — Trabalho em altura')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Tipo de documento cadastrado.');
  });

  it('mostra a abrangência de cada tipo em texto', async () => {
    renderizarRota('/tipos-documento');
    const tabela = await screen.findByRole('table', { name: 'Tipos de documento' });
    expect(within(tabela).getByRole('columnheader', { name: 'Abrangência' })).toBeInTheDocument();
    const cnpj = within(tabela).getByText('Cartão CNPJ').closest('tr')!;
    expect(within(cnpj).getByText('Geral da empresa')).toBeInTheDocument();
    const art = within(tabela).getByText('ART da obra').closest('tr')!;
    expect(within(art).getByText('Por obra')).toBeInTheDocument();
  });

  it('filtra por abrangência', async () => {
    const { usuario, local } = renderizarRota('/tipos-documento');
    await screen.findByRole('table', { name: 'Tipos de documento' });
    await usuario.selectOptions(screen.getByLabelText('Abrangência'), 'POR_OBRA');
    await usuario.click(screen.getByRole('button', { name: 'Pesquisar' }));
    await waitFor(() => expect(screen.queryByText('Cartão CNPJ')).not.toBeInTheDocument());
    const tabela = screen.getByRole('table', { name: 'Tipos de documento' });
    expect(within(tabela).getByText('ART da obra')).toBeInTheDocument();
    expect(within(tabela).getByText('Ordem de serviço')).toBeInTheDocument();
    expect(local()).toContain('abrangencia=POR_OBRA');
  });

  it('a abrangência é obrigatória no cadastro', async () => {
    const { usuario } = renderizarRota('/tipos-documento');
    await screen.findByRole('table', { name: 'Tipos de documento' });
    await usuario.click(screen.getByRole('button', { name: 'Novo tipo de documento' }));
    const dialogo = screen.getByRole('dialog', { name: 'Novo tipo de documento' });
    await usuario.type(within(dialogo).getByLabelText(/Nome/), 'Projeto executivo');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    expect(await within(dialogo).findByText('Escolha a abrangência: geral da empresa ou por obra.')).toBeInTheDocument();

    await usuario.click(within(dialogo).getByRole('radio', { name: /Por obra/ }));
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent('Marque-o nas obras que o exigem');
    const linha = (await screen.findByText('Projeto executivo')).closest('tr')!;
    expect(within(linha).getByText('Por obra')).toBeInTheDocument();
  });

  it('trocar a abrangência de tipo com envios mostra a mensagem do 409', async () => {
    const { usuario } = renderizarRota('/tipos-documento');
    const tabela = await screen.findByRole('table', { name: 'Tipos de documento' });
    const linha = within(tabela).getByText('Cartão CNPJ').closest('tr')!;
    await usuario.click(within(linha).getByRole('button', { name: 'Editar Cartão CNPJ' }));
    const dialogo = screen.getByRole('dialog', { name: 'Editar tipo de documento' });
    expect(within(dialogo).getByRole('radio', { name: /Geral da empresa/ })).toBeChecked();
    await usuario.click(within(dialogo).getByRole('radio', { name: /Por obra/ }));
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    expect(
      await within(dialogo).findByText('A abrangência não pode ser alterada porque este tipo já tem envios.'),
    ).toBeInTheDocument();
  });

  it('avisa que as marcações nas obras saem ao trocar de por obra para geral', async () => {
    const { usuario } = renderizarRota('/tipos-documento');
    const tabela = await screen.findByRole('table', { name: 'Tipos de documento' });
    const linha = within(tabela).getByText('PGR do canteiro').closest('tr')!;
    await usuario.click(within(linha).getByRole('button', { name: 'Editar PGR do canteiro' }));
    const dialogo = screen.getByRole('dialog', { name: 'Editar tipo de documento' });
    await usuario.click(within(dialogo).getByRole('radio', { name: /Geral da empresa/ }));
    expect(within(dialogo).getByText(/deixa de ser exigido nas obras que o marcaram/)).toBeInTheDocument();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const atualizada = (await screen.findByText('PGR do canteiro')).closest('tr')!;
    await waitFor(() => expect(within(atualizada).getByText('Geral da empresa')).toBeInTheDocument());
  });

  it('nome duplicado mostra a mensagem do contrato', async () => {
    const { usuario } = renderizarRota('/tipos-documento');
    await screen.findByRole('table', { name: 'Tipos de documento' });
    await usuario.click(screen.getByRole('button', { name: 'Novo tipo de documento' }));
    const dialogo = screen.getByRole('dialog');
    await usuario.type(within(dialogo).getByLabelText(/Nome/), 'cartão cnpj');
    await usuario.click(within(dialogo).getByRole('radio', { name: /Geral da empresa/ }));
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    expect(await within(dialogo).findByText('Já existe um tipo de documento com este nome.')).toBeInTheDocument();
  });

  it('desativar pede confirmação e avisa que o tipo deixa de ser exigido', async () => {
    const { usuario } = renderizarRota('/tipos-documento');
    const tabela = await screen.findByRole('table', { name: 'Tipos de documento' });
    const linha = within(tabela).getByText('PCMSO').closest('tr')!;
    await usuario.click(within(linha).getByRole('button', { name: /Desativar/ }));
    const dialogo = screen.getByRole('dialog', { name: 'Desativar tipo de documento?' });
    expect(dialogo).toHaveTextContent('Este tipo deixa de ser exigido das empresas.');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Desativar' }));
    await waitFor(() => expect(within(linha).getByText('Inativo')).toBeInTheDocument());
  });
});

describe('Tipos de documento — periodicidade (003)', () => {
  it('mostra a periodicidade em texto; tipos antigos aparecem como "Único"', async () => {
    renderizarRota('/tipos-documento');
    const tabela = await screen.findByRole('table', { name: 'Tipos de documento' });
    expect(within(tabela).getByRole('columnheader', { name: 'Periodicidade' })).toBeInTheDocument();
    const fgts = within(tabela).getByText('Guia do FGTS').closest('tr')!;
    expect(within(fgts).getByText('Mensal · até o dia 15 do mês seguinte')).toBeInTheDocument();
    const trimestral = within(tabela).getByText('Relatório trimestral').closest('tr')!;
    expect(within(trimestral).getByText('Trimestral · até 10 dias após o fim do período')).toBeInTheDocument();
    const cnpj = within(tabela).getByText('Cartão CNPJ').closest('tr')!;
    expect(within(cnpj).getByText('Único')).toBeInTheDocument();
  });

  it('filtra "Periódicos" e "Únicos"', async () => {
    const { usuario, local } = renderizarRota('/tipos-documento');
    await screen.findByRole('table', { name: 'Tipos de documento' });
    await usuario.selectOptions(screen.getByLabelText('Periodicidade'), 'periodicos');
    await usuario.click(screen.getByRole('button', { name: 'Pesquisar' }));
    await waitFor(() => expect(screen.queryByText('Cartão CNPJ')).not.toBeInTheDocument());
    const tabela = screen.getByRole('table', { name: 'Tipos de documento' });
    expect(within(tabela).getAllByRole('row')).toHaveLength(3);
    expect(local()).toContain('periodicidade=periodicos');

    await usuario.selectOptions(screen.getByLabelText('Periodicidade'), 'unicos');
    await usuario.click(screen.getByRole('button', { name: 'Pesquisar' }));
    await waitFor(() => expect(screen.queryByText('Guia do FGTS')).not.toBeInTheDocument());
    expect(screen.getByText('Cartão CNPJ')).toBeInTheDocument();
  });

  it('desativar e reativar não perde a periodicidade', async () => {
    const { usuario } = renderizarRota('/tipos-documento');
    await screen.findByRole('table', { name: 'Tipos de documento' });
    await usuario.click(screen.getByRole('button', { name: 'Desativar Guia do FGTS' }));
    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desativar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const fgts = screen.getByText('Guia do FGTS').closest('tr')!;
    expect(within(fgts).getByText('Mensal · até o dia 15 do mês seguinte')).toBeInTheDocument();
    expect(within(fgts).getByText('Inativo')).toBeInTheDocument();
  });
});
