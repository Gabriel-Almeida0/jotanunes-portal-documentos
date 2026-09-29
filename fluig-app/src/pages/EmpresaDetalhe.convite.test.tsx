import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { IDS } from '../mocks/dados';
import { server } from '../mocks/server';
import { renderizarRota } from '../test/renderizar';

function secaoAcesso() {
  return screen.getByRole('region', { name: 'Acesso ao portal' });
}

describe('Detalhe da empresa — convite', () => {
  it('enviar convite muda o selo para "Convidada" e mostra a confirmação', async () => {
    const { usuario } = renderizarRota(`/empresas/${IDS.empresaGama}`);
    await screen.findByRole('heading', { level: 1, name: 'Gama Instalações Elétricas Ltda' });
    expect(within(secaoAcesso()).getByText('Não convidada')).toBeInTheDocument();

    await usuario.click(within(secaoAcesso()).getByRole('button', { name: 'Enviar convite' }));

    expect(await within(secaoAcesso()).findByText('Convite enviado para financeiro@gama.test.')).toBeInTheDocument();
    await waitFor(() => expect(within(secaoAcesso()).getAllByText('Convidada').length).toBeGreaterThan(0));
    expect(within(secaoAcesso()).getByRole('button', { name: 'Reenviar convite' })).toBeInTheDocument();
    // Depois do convite o CNPJ fica bloqueado para edição.
    await waitFor(() => expect(screen.getByLabelText(/^CNPJ/)).toHaveAttribute('readonly'));
  });

  it('reenviar pede confirmação avisando que a senha e o link anteriores deixam de valer', async () => {
    const { usuario } = renderizarRota(`/empresas/${IDS.empresaAlfa}`);
    await screen.findByRole('heading', { level: 1, name: 'Alfa Engenharia Ltda' });
    await usuario.click(within(secaoAcesso()).getByRole('button', { name: 'Reenviar convite' }));
    const dialogo = screen.getByRole('dialog', { name: 'Reenviar convite?' });
    expect(dialogo).toHaveTextContent('A senha e o link anteriores deixam de valer. Continuar?');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Reenviar convite' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(within(secaoAcesso()).getAllByText('Convidada').length).toBeGreaterThan(0));
  });

  it('cancelar o reenvio não chama a API', async () => {
    let chamou = false;
    server.events.on('request:start', ({ request }) => {
      if (request.method === 'POST') chamou = true;
    });
    const { usuario } = renderizarRota(`/empresas/${IDS.empresaAlfa}`);
    await screen.findByRole('heading', { level: 1, name: 'Alfa Engenharia Ltda' });
    await usuario.click(within(secaoAcesso()).getByRole('button', { name: 'Reenviar convite' }));
    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(chamou).toBe(false);
    server.events.removeAllListeners();
  });

  it('EMAIL_FALHOU mostra a mensagem do contrato e mantém a situação', async () => {
    server.use(
      http.post('*/api/fluig/empresas/:empresaId/convites', () =>
        Response.json(
          {
            type: 'https://jotanunes.com/problemas/email-falhou',
            title: 'Não conseguimos enviar o convite. Tente de novo em alguns minutos.',
            status: 502,
            code: 'EMAIL_FALHOU',
          },
          { status: 502, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    );
    const { usuario } = renderizarRota(`/empresas/${IDS.empresaGama}`);
    await screen.findByRole('heading', { level: 1, name: 'Gama Instalações Elétricas Ltda' });
    await usuario.click(within(secaoAcesso()).getByRole('button', { name: 'Enviar convite' }));

    expect(
      await within(secaoAcesso()).findByText('Não conseguimos enviar o convite. Tente de novo em alguns minutos.'),
    ).toBeInTheDocument();
    expect(within(secaoAcesso()).getByText('Não convidada')).toBeInTheDocument();
    expect(within(secaoAcesso()).getByRole('button', { name: 'Enviar convite' })).toBeEnabled();
  });

  it('empresa desativada não pode receber convite', async () => {
    renderizarRota(`/empresas/${IDS.empresaEpsilon}`);
    await screen.findByRole('heading', { level: 1, name: 'Épsilon Terraplenagem Ltda' });
    expect(within(secaoAcesso()).getByRole('button', { name: 'Reenviar convite' })).toBeDisabled();
    expect(within(secaoAcesso()).getByText('Ative a empresa para enviar o convite.')).toBeInTheDocument();
  });
});
