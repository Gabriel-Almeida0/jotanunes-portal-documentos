import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { DATA_FIXA_TESTES, IDS, fixarRelogioMock, reiniciarDados } from '../mocks/dados';
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

  it('envio geral mostra "Geral da empresa" no topo e o histórico do documento geral', async () => {
    await abrirEnvio();
    expect(screen.getByText('Geral da empresa')).toBeInTheDocument();
    const historico = await screen.findByRole('list', { name: 'Histórico deste documento' });
    expect(within(historico).getAllByRole('listitem')).toHaveLength(1);
    expect(within(historico).getByText('PCMSO 2026 - Alfa Engenharia.pdf')).toBeInTheDocument();
  });

  it('envio por obra mostra a obra no topo e só o histórico daquele documento naquela obra', async () => {
    renderizarRota(`/analise/${IDS.envioAlfaArtFlorDeSal}`);
    await screen.findByRole('heading', { level: 1, name: 'ART da obra' });
    expect(screen.getByRole('link', { name: 'Obra: Condomínio Flor de Sal' })).toHaveAttribute(
      'href',
      `/obras/${IDS.obraFlorDeSal}`,
    );
    const historico = await screen.findByRole('list', { name: 'Histórico deste documento' });
    // O ART da mesma empresa na obra Vista do Rio não entra.
    expect(within(historico).getAllByRole('listitem')).toHaveLength(1);
    expect(within(historico).getByText('art-flor-de-sal.pdf')).toBeInTheDocument();
    expect(within(historico).queryByText('art-vista-do-rio.pdf')).not.toBeInTheDocument();
  });

  it('rejeitar envio por obra cita a obra no aviso', async () => {
    const { usuario } = renderizarRota(`/analise/${IDS.envioAlfaArtFlorDeSal}`);
    await screen.findByRole('heading', { level: 1, name: 'ART da obra' });
    await usuario.click(screen.getByRole('button', { name: 'Rejeitar' }));
    const dialogo = screen.getByRole('dialog', { name: 'Rejeitar documento' });
    expect(dialogo).toHaveTextContent('ART da obra de Alfa Engenharia Ltda na obra Condomínio Flor de Sal');
    await usuario.type(within(dialogo).getByLabelText(/Motivo da rejeição/), 'Falta a assinatura do responsável');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Rejeitar documento' }));
    expect(
      await screen.findByText('ART da obra de Alfa Engenharia Ltda na obra Condomínio Flor de Sal. A empresa foi avisada por e-mail.'),
    ).toBeInTheDocument();
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
          tipoDocumento: { id: IDS.tipoPcmso, nome: 'PCMSO', instrucoes: null, abrangencia: 'GERAL' },
          obraId: null,
          obra: null,
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

  describe('envio periódico (003)', () => {
    beforeEach(() => {
      fixarRelogioMock(DATA_FIXA_TESTES);
      reiniciarDados();
    });

    it('mostra o período e o prazo no topo e só o histórico daquele período', async () => {
      renderizarRota(`/analise/${IDS.envioAlfaFgtsAtrasado}`);
      await screen.findByRole('heading', { level: 1, name: 'Guia do FGTS' });
      const periodo = screen.getByText('Agosto/2026', { selector: 'strong' }).parentElement!;
      expect(periodo).toHaveTextContent('Período: Agosto/2026 · prazo 15/09/2026');
      expect(screen.getAllByText('Com atraso').length).toBeGreaterThan(0);
      expect(screen.getByText('15/09/2026 — enviado depois do prazo')).toBeInTheDocument();
      const historico = await screen.findByRole('list', { name: 'Histórico do período Agosto/2026' });
      // O envio aprovado de julho é de outro período e não entra.
      expect(within(historico).getAllByRole('listitem')).toHaveLength(1);
      expect(within(historico).queryByText(/fgts-2026-07/)).not.toBeInTheDocument();
    });

    it('a rejeição cita o período', async () => {
      const { usuario } = renderizarRota(`/analise/${IDS.envioAlfaFgtsAtrasado}`);
      await screen.findByRole('heading', { level: 1, name: 'Guia do FGTS' });
      await usuario.click(screen.getByRole('button', { name: 'Rejeitar' }));
      expect(
        within(screen.getByRole('dialog', { name: 'Rejeitar documento' })).getByText('Guia do FGTS (Agosto/2026) de Alfa Engenharia Ltda'),
      ).toBeInTheDocument();
    });
  });
});
