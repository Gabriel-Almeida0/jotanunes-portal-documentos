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
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('NR-35 — Trabalho em altura')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Tipo de documento cadastrado.');
  });

  it('nome duplicado mostra a mensagem do contrato', async () => {
    const { usuario } = renderizarRota('/tipos-documento');
    await screen.findByRole('table', { name: 'Tipos de documento' });
    await usuario.click(screen.getByRole('button', { name: 'Novo tipo de documento' }));
    const dialogo = screen.getByRole('dialog');
    await usuario.type(within(dialogo).getByLabelText(/Nome/), 'cartão cnpj');
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
