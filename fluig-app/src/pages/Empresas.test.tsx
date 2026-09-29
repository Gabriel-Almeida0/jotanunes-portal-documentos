import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { server } from '../mocks/server';
import { renderizarRota } from '../test/renderizar';

async function abrirNovaEmpresa() {
  const r = renderizarRota('/empresas');
  await screen.findByRole('table', { name: 'Empresas' });
  await r.usuario.click(screen.getByRole('button', { name: 'Nova empresa' }));
  return { ...r, dialogo: screen.getByRole('dialog', { name: 'Nova empresa' }) };
}

describe('Empresas', () => {
  it('lista com CNPJ mascarado e selo de acesso', async () => {
    renderizarRota('/empresas');
    const tabela = await screen.findByRole('table', { name: 'Empresas' });
    const beta = within(tabela).getByText('Beta Serviços de Montagem S.A.').closest('tr')!;
    expect(within(beta).getByText('12.ABC.345/01DE-35')).toBeInTheDocument();
    expect(within(beta).getByText('Convidada')).toBeInTheDocument();
  });

  it('busca por CNPJ com máscara', async () => {
    const { usuario } = renderizarRota('/empresas');
    await screen.findByRole('table', { name: 'Empresas' });
    await usuario.type(screen.getByLabelText('Buscar'), '12.345.678');
    await usuario.click(screen.getByRole('button', { name: 'Pesquisar' }));
    await waitFor(() => expect(screen.queryByText('Alfa Engenharia Ltda')).not.toBeInTheDocument());
    expect(screen.getByText('Gama Instalações Elétricas Ltda')).toBeInTheDocument();
  });

  it('cadastra empresa com CNPJ válido e abre o detalhe com acesso "Não convidada"', async () => {
    const { usuario, dialogo } = await abrirNovaEmpresa();
    await usuario.type(within(dialogo).getByLabelText(/Razão social/), 'Ômega Construções Ltda');
    await usuario.type(within(dialogo).getByLabelText(/^CNPJ/), '55667788000186');
    expect(within(dialogo).getByLabelText(/^CNPJ/)).toHaveValue('55.667.788/0001-86');
    await usuario.type(within(dialogo).getByLabelText(/E-mail de contato/), 'contato@omega.test');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Ômega Construções Ltda' })).toBeInTheDocument();
    expect(screen.getAllByText('Não convidada').length).toBeGreaterThan(0);
  });

  it('CNPJ inválido mostra erro no campo sem chamar a API', async () => {
    let chamouApi = false;
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'POST') chamouApi = true;
    });
    const { usuario, dialogo } = await abrirNovaEmpresa();
    await usuario.type(within(dialogo).getByLabelText(/Razão social/), 'Empresa Teste');
    await usuario.type(within(dialogo).getByLabelText(/^CNPJ/), '12.345.678/0001-96');
    await usuario.type(within(dialogo).getByLabelText(/E-mail de contato/), 'a@b.test');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    const campo = within(dialogo).getByLabelText(/^CNPJ/);
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription(/CNPJ inválido/);
    expect(chamouApi).toBe(false);
    server.events.removeAllListeners();
  });

  it('CNPJ duplicado mostra "Já existe uma empresa com este CNPJ."', async () => {
    const { usuario, dialogo } = await abrirNovaEmpresa();
    await usuario.type(within(dialogo).getByLabelText(/Razão social/), 'Alfa de novo');
    await usuario.type(within(dialogo).getByLabelText(/^CNPJ/), '11222333000181');
    await usuario.type(within(dialogo).getByLabelText(/E-mail de contato/), 'outra@alfa.test');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    expect(await within(dialogo).findByText('Já existe uma empresa com este CNPJ.')).toBeInTheDocument();
  });

  it('mostra o erro do servidor por campo (VALIDACAO)', async () => {
    server.use(
      http.post('*/api/fluig/empresas', () =>
        Response.json(
          { type: 'x', title: 'Confira os dados informados.', status: 400, code: 'VALIDACAO', errors: { emailContato: ['E-mail inválido.'] } },
          { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    );
    const { usuario, dialogo } = await abrirNovaEmpresa();
    await usuario.type(within(dialogo).getByLabelText(/Razão social/), 'Empresa X');
    await usuario.type(within(dialogo).getByLabelText(/^CNPJ/), '66778899000186');
    await usuario.type(within(dialogo).getByLabelText(/E-mail de contato/), 'x@y.test');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    expect(await within(dialogo).findByText('E-mail inválido.')).toBeInTheDocument();
  });
});
