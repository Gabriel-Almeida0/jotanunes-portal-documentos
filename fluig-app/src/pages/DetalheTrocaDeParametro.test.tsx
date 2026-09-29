import { screen, within } from '@testing-library/react';
import { IDS } from '../mocks/dados';
import { renderizarRota } from '../test/renderizar';

/**
 * Regressão: ao trocar o parâmetro da rota (`/empresas/:empresaId`, `/obras/:obraId`,
 * `/analise/:envioId`) sem sair da página, modais e estados locais da página anterior não podem
 * continuar abertos sobre a página nova.
 */
describe('Páginas de detalhe — troca do parâmetro da rota', () => {
  it('empresa: o modal de histórico da Alfa fecha ao navegar para a Beta', async () => {
    const { usuario, navegar } = renderizarRota(`/empresas/${IDS.empresaAlfa}`);
    await screen.findByRole('heading', { level: 1, name: 'Alfa Engenharia Ltda' });
    await usuario.click(await screen.findByRole('button', { name: 'Histórico de Cartão CNPJ' }));
    expect(screen.getByRole('dialog', { name: 'Histórico: Cartão CNPJ' })).toBeInTheDocument();

    navegar(`/empresas/${IDS.empresaBeta}`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Beta Serviços de Montagem S.A.' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Alfa Engenharia Ltda' })).not.toBeInTheDocument();
  });

  it('empresa: o modal de desativar da Alfa fecha ao navegar para a Beta', async () => {
    const { usuario, navegar } = renderizarRota(`/empresas/${IDS.empresaAlfa}`);
    await screen.findByRole('heading', { level: 1, name: 'Alfa Engenharia Ltda' });
    await usuario.click(screen.getByRole('button', { name: 'Desativar empresa' }));
    expect(screen.getByRole('dialog', { name: 'Desativar empresa?' })).toBeInTheDocument();

    navegar(`/empresas/${IDS.empresaBeta}`);

    await screen.findByRole('heading', { level: 1, name: 'Beta Serviços de Montagem S.A.' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('obra: o modal de vincular empresa fecha ao navegar para outra obra', async () => {
    const { usuario, navegar } = renderizarRota(`/obras/${IDS.obraFlorDeSal}`);
    await screen.findByRole('heading', { level: 1, name: 'Condomínio Flor de Sal' });
    await usuario.click(screen.getByRole('button', { name: 'Vincular empresa' }));
    const dialogo = screen.getByRole('dialog', { name: 'Vincular empresa à obra' });
    await usuario.type(within(dialogo).getByLabelText('Buscar empresa'), 'gama');

    navegar(`/obras/${IDS.obraVistaDoRio}`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Residencial Vista do Rio' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('obra: o modal de desvincular fecha ao navegar para outra obra', async () => {
    const { usuario, navegar } = renderizarRota(`/obras/${IDS.obraFlorDeSal}`);
    const tabela = await screen.findByRole('table', { name: 'Empresas da obra' });
    const linha = within(tabela).getByText('Delta Pinturas e Acabamentos ME').closest('tr')!;
    await usuario.click(within(linha).getByRole('button', { name: /Desvincular/ }));
    expect(screen.getByRole('dialog', { name: 'Desvincular empresa?' })).toBeInTheDocument();

    navegar(`/obras/${IDS.obraVistaDoRio}`);

    await screen.findByRole('heading', { level: 1, name: 'Residencial Vista do Rio' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('análise: o modal de rejeição (com motivo digitado) fecha ao navegar para outro envio', async () => {
    const { usuario, navegar } = renderizarRota(`/analise/${IDS.envioAlfaPcmso}`);
    await screen.findByRole('heading', { level: 1, name: 'PCMSO' });
    await usuario.click(screen.getByRole('button', { name: 'Rejeitar' }));
    const dialogo = screen.getByRole('dialog', { name: 'Rejeitar documento' });
    await usuario.type(within(dialogo).getByLabelText(/Motivo da rejeição/), 'Arquivo ilegível');

    navegar(`/analise/${IDS.envioZetaAso}`);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'ASO — Atestado de Saúde Ocupacional' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('análise: o modal de aprovar fecha ao navegar para outro envio', async () => {
    const { usuario, navegar } = renderizarRota(`/analise/${IDS.envioAlfaPcmso}`);
    await screen.findByRole('heading', { level: 1, name: 'PCMSO' });
    await usuario.click(screen.getByRole('button', { name: 'Aprovar' }));
    expect(screen.getByRole('dialog', { name: 'Aprovar documento?' })).toBeInTheDocument();

    navegar(`/analise/${IDS.envioZetaAso}`);

    await screen.findByRole('heading', { level: 1, name: 'ASO — Atestado de Saúde Ocupacional' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
