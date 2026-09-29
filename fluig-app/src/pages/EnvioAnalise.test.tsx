import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { IDS } from '../mocks/dados';
import { server } from '../mocks/server';
import { renderizarRota } from '../test/renderizar';

async function abrirEnvio(id: string = IDS.envioAlfaPcmso) {
  const r = renderizarRota(`/analise/${id}`);
  await screen.findByRole('heading', { level: 1, name: 'PCMSO' });
  return r;
}

describe('Análise de um envio', () => {
  it('mostra os dados do envio e a empresa', async () => {
    await abrirEnvio();
    expect(screen.getByText('PCMSO 2026 - Alfa Engenharia.pdf')).toBeInTheDocument();
    expect(screen.getAllByText('Em análise').length).toBeGreaterThan(0);
    expect(screen.getByText('11.222.333/0001-81')).toBeInTheDocument();
  });

  it('aprovar registra a decisão e mostra "Aprovado" ao voltar para a fila', async () => {
    const { usuario, local } = await abrirEnvio();
    await usuario.click(screen.getByRole('button', { name: 'Aprovar' }));
    const dialogo = screen.getByRole('dialog', { name: 'Aprovar documento?' });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Aprovar' }));

    expect(await screen.findByText('Aprovado')).toBeInTheDocument();
    expect(local()).toBe('/analise');
    expect(screen.getByText('PCMSO de Alfa Engenharia Ltda.')).toBeInTheDocument();
  });

  it('rejeitar sem motivo é bloqueado no cliente', async () => {
    let chamou = false;
    server.events.on('request:start', ({ request }) => {
      if (request.url.includes('/rejeitar')) chamou = true;
    });
    const { usuario } = await abrirEnvio();
    await usuario.click(screen.getByRole('button', { name: 'Rejeitar' }));
    const dialogo = screen.getByRole('dialog', { name: 'Rejeitar documento' });
    await usuario.type(within(dialogo).getByLabelText(/Motivo da rejeição/), 'ruim');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Rejeitar documento' }));

    expect(within(dialogo).getByText('Informe o motivo da rejeição (de 5 a 500 caracteres).')).toBeInTheDocument();
    expect(within(dialogo).getByLabelText(/Motivo da rejeição/)).toHaveAttribute('aria-invalid', 'true');
    expect(chamou).toBe(false);
    server.events.removeAllListeners();
  });

  it('rejeitar com motivo mostra "Rejeitado"', async () => {
    const { usuario } = await abrirEnvio();
    await usuario.click(screen.getByRole('button', { name: 'Rejeitar' }));
    const dialogo = screen.getByRole('dialog', { name: 'Rejeitar documento' });
    await usuario.type(within(dialogo).getByLabelText(/Motivo da rejeição/), 'Documento ilegível, envie de novo');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Rejeitar documento' }));

    expect(await screen.findByText('Rejeitado')).toBeInTheDocument();
    expect(screen.getByText('PCMSO de Alfa Engenharia Ltda. A empresa foi avisada por e-mail.')).toBeInTheDocument();
  });

  it('ENVIO_JA_ANALISADO exibe "Este envio já foi analisado." e recarrega o envio', async () => {
    let jaAnalisado = false;
    server.use(
      http.post('*/api/fluig/envios/:envioId/aprovar', () => {
        jaAnalisado = true;
        return Response.json(
          { type: 'x', title: 'Este envio já foi analisado.', status: 409, code: 'ENVIO_JA_ANALISADO' },
          { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
        );
      }),
      http.get('*/api/fluig/envios/:envioId', ({ params }) => {
        const base = {
          id: params.envioId,
          empresaId: IDS.empresaAlfa,
          tipoDocumentoId: IDS.tipoPcmso,
          nomeArquivo: 'PCMSO 2026 - Alfa Engenharia.pdf',
          formato: 'application/pdf',
          tamanhoBytes: 1000,
          enviadoEm: '2026-09-20T12:00:00Z',
          empresa: { id: IDS.empresaAlfa, razaoSocial: 'Alfa Engenharia Ltda', cnpj: '11222333000181' },
          tipoDocumento: { id: IDS.tipoPcmso, nome: 'PCMSO', instrucoes: null },
        };
        return Response.json(
          jaAnalisado
            ? { ...base, status: 'APROVADO', analisadoEm: '2026-09-21T12:00:00Z', analisadoPor: { login: 'maria.silva', nome: 'Maria Silva' } }
            : { ...base, status: 'EM_ANALISE', analisadoEm: null, analisadoPor: null },
        );
      }),
    );
    const { usuario } = await abrirEnvio();
    await usuario.click(screen.getByRole('button', { name: 'Aprovar' }));
    await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Aprovar' }));

    expect(await screen.findByText('Este envio já foi analisado.')).toBeInTheDocument();
    expect(await screen.findByText('Maria Silva')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Aprovar' })).not.toBeInTheDocument());
  });
});
