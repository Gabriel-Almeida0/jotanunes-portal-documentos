import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { IDS } from '../mocks/dados';
import { server } from '../mocks/server';
import { renderizarRota } from '../test/renderizar';

function formDados() {
  return screen.getByRole('form', { name: 'Dados da empresa' });
}

describe('Detalhe da empresa — dados e ativação', () => {
  it('edita os dados, salva e mostra a confirmação com o novo nome no título', async () => {
    const { usuario } = renderizarRota(`/empresas/${IDS.empresaGama}`);
    await screen.findByRole('heading', { level: 1, name: 'Gama Instalações Elétricas Ltda' });

    const razao = within(formDados()).getByLabelText(/Razão social/);
    await usuario.clear(razao);
    await usuario.type(razao, 'Gama Elétrica Ltda');
    await usuario.type(within(formDados()).getByLabelText(/Nome fantasia/), 'Gama');
    await usuario.click(within(formDados()).getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByText('Dados da empresa salvos.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Gama Elétrica Ltda' })).toBeInTheDocument();
    expect(within(formDados()).getByLabelText(/Nome fantasia/)).toHaveValue('Gama');
  });

  it('CNPJ fica bloqueado quando a empresa já foi convidada (cnpjEditavel=false)', async () => {
    renderizarRota(`/empresas/${IDS.empresaAlfa}`);
    await screen.findByRole('heading', { level: 1, name: 'Alfa Engenharia Ltda' });
    const cnpj = within(formDados()).getByLabelText(/^CNPJ/);
    expect(cnpj).toHaveAttribute('readonly');
    expect(cnpj).toHaveValue('11.222.333/0001-81');
    expect(cnpj).toHaveAccessibleDescription(/O CNPJ não pode ser alterado depois do convite\./);
  });

  it('CNPJ editável enquanto não há convite', async () => {
    renderizarRota(`/empresas/${IDS.empresaGama}`);
    await screen.findByRole('heading', { level: 1, name: 'Gama Instalações Elétricas Ltda' });
    expect(within(formDados()).getByLabelText(/^CNPJ/)).not.toHaveAttribute('readonly');
  });

  it('mostra no campo CNPJ o erro CNPJ_IMUTAVEL devolvido pelo servidor', async () => {
    server.use(
      http.put('*/api/fluig/empresas/:empresaId', () =>
        Response.json(
          {
            type: 'https://jotanunes.com/problemas/cnpj-imutavel',
            title: 'O CNPJ não pode ser alterado depois do convite.',
            status: 409,
            code: 'CNPJ_IMUTAVEL',
          },
          { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    );
    const { usuario } = renderizarRota(`/empresas/${IDS.empresaGama}`);
    await screen.findByRole('heading', { level: 1, name: 'Gama Instalações Elétricas Ltda' });

    const cnpj = within(formDados()).getByLabelText(/^CNPJ/);
    await usuario.clear(cnpj);
    await usuario.type(cnpj, '55667788000186');
    await usuario.click(within(formDados()).getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(cnpj).toHaveAttribute('aria-invalid', 'true'));
    expect(cnpj).toHaveAccessibleDescription(/O CNPJ não pode ser alterado depois do convite\./);
    expect(screen.queryByText('Dados da empresa salvos.')).not.toBeInTheDocument();
  });

  it('desativar pede confirmação e muda o selo para "Desativada"', async () => {
    const { usuario } = renderizarRota(`/empresas/${IDS.empresaAlfa}`);
    await screen.findByRole('heading', { level: 1, name: 'Alfa Engenharia Ltda' });
    expect(screen.queryByText('Desativada')).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Desativar empresa' }));
    const dialogo = screen.getByRole('dialog', { name: 'Desativar empresa?' });
    expect(dialogo).toHaveTextContent('A empresa perde o acesso ao portal na hora');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Desativar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Empresa desativada. O acesso ao portal foi bloqueado.')).toBeInTheDocument();
    expect(screen.getAllByText('Desativada').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Ativar empresa' })).toBeInTheDocument();
  });

  it('cancelar a desativação não altera a empresa', async () => {
    let chamou = false;
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'PUT') chamou = true;
    });
    const { usuario } = renderizarRota(`/empresas/${IDS.empresaAlfa}`);
    await screen.findByRole('heading', { level: 1, name: 'Alfa Engenharia Ltda' });
    await usuario.click(screen.getByRole('button', { name: 'Desativar empresa' }));
    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(chamou).toBe(false);
    expect(screen.queryByText('Desativada')).not.toBeInTheDocument();
    server.events.removeAllListeners();
  });

  it('ativar uma empresa desativada tira o selo "Desativada"', async () => {
    const { usuario } = renderizarRota(`/empresas/${IDS.empresaEpsilon}`);
    await screen.findByRole('heading', { level: 1, name: 'Épsilon Terraplenagem Ltda' });
    expect(screen.getAllByText('Desativada').length).toBeGreaterThan(0);

    await usuario.click(screen.getByRole('button', { name: 'Ativar empresa' }));
    await usuario.click(within(screen.getByRole('dialog', { name: 'Ativar empresa?' })).getByRole('button', { name: 'Ativar' }));

    expect(await screen.findByText('Empresa ativada.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Desativada')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Desativar empresa' })).toBeInTheDocument();
  });
});
