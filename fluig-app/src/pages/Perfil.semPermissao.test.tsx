/**
 * 403 SEM_PERMISSAO com a interface de administrador (ex.: o papel foi retirado no Fluig e o token
 * novo chegou só para a API): a mensagem aparece na tela, o modal fecha, os dados ficam e a sessão
 * continua (FR-084, US6/AC6).
 */
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { IDS } from '../mocks/dados';
import { server } from '../mocks/server';
import { renderizarRota } from '../test/renderizar';

const TITULO = 'Só administradores podem fazer isso. Se você precisa, fale com a TI.';

function semPermissao() {
  return HttpResponse.json(
    { type: 'https://jotanunes.com/problemas/sem-permissao', title: TITULO, status: 403, code: 'SEM_PERMISSAO', traceId: 't' },
    { status: 403, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

async function mensagemNaTela() {
  const alerta = await screen.findByRole('alert');
  expect(alerta).toHaveTextContent(TITULO);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.queryByText('Abra este sistema pelo Fluig.')).not.toBeInTheDocument();
}

describe('403 SEM_PERMISSAO', () => {
  it('ao criar tipo de documento', async () => {
    server.use(http.post('*/api/fluig/tipos-documento', semPermissao));
    const { usuario } = renderizarRota('/tipos-documento');
    const tabela = await screen.findByRole('table', { name: 'Tipos de documento' });
    await usuario.click(screen.getByRole('button', { name: 'Novo tipo de documento' }));
    const dialogo = screen.getByRole('dialog', { name: 'Novo tipo de documento' });
    await usuario.type(within(dialogo).getByLabelText(/Nome/), 'NR-35 — Trabalho em altura');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    await mensagemNaTela();
    expect(within(tabela).getByText('Cartão CNPJ')).toBeInTheDocument();
    expect(screen.queryByText('NR-35 — Trabalho em altura')).not.toBeInTheDocument();
  });

  it('ao salvar obra', async () => {
    server.use(http.put('*/api/fluig/obras/:obraId', semPermissao));
    const { usuario } = renderizarRota(`/obras/${IDS.obraVistaDoRio}`);
    await screen.findByRole('heading', { level: 1, name: 'Residencial Vista do Rio' });
    await usuario.click(screen.getByRole('button', { name: /Editar dados/ }));
    const dialogo = screen.getByRole('dialog', { name: 'Editar obra' });
    const nome = within(dialogo).getByLabelText(/Nome da obra/);
    await usuario.clear(nome);
    await usuario.type(nome, 'Outro nome');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    await mensagemNaTela();
    expect(screen.getByRole('heading', { level: 1, name: 'Residencial Vista do Rio' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Empresas da obra' })).toBeInTheDocument();
  });

  it('ao vincular empresa', async () => {
    server.use(http.put('*/api/fluig/obras/:obraId/empresas/:empresaId', semPermissao));
    const { usuario } = renderizarRota(`/obras/${IDS.obraFlorDeSal}`);
    await screen.findByRole('heading', { level: 1, name: 'Condomínio Flor de Sal' });
    await usuario.click(screen.getAllByRole('button', { name: 'Vincular empresa' })[0]);
    const dialogo = screen.getByRole('dialog', { name: 'Vincular empresa à obra' });
    await usuario.click(await within(dialogo).findByRole('button', { name: 'Vincular Gama Instalações Elétricas Ltda' }));

    await mensagemNaTela();
    const tabela = screen.getByRole('table', { name: 'Empresas da obra' });
    expect(within(tabela).getByText('Alfa Engenharia Ltda')).toBeInTheDocument();
    expect(within(tabela).queryByText('Gama Instalações Elétricas Ltda')).not.toBeInTheDocument();
  });

  it('ao aprovar envio', async () => {
    server.use(http.post('*/api/fluig/envios/:envioId/aprovar', semPermissao));
    const { usuario, local } = renderizarRota(`/analise/${IDS.envioAlfaPcmso}`);
    await screen.findByRole('heading', { level: 1, name: 'PCMSO' });
    await usuario.click(screen.getByRole('button', { name: 'Aprovar' }));
    const dialogo = screen.getByRole('dialog', { name: 'Aprovar documento?' });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Aprovar' }));

    await mensagemNaTela();
    expect(local()).toBe(`/analise/${IDS.envioAlfaPcmso}`);
    expect(screen.getByText('PCMSO 2026 - Alfa Engenharia.pdf')).toBeInTheDocument();
    expect(screen.getAllByText('Em análise').length).toBeGreaterThan(0);
  });
});
