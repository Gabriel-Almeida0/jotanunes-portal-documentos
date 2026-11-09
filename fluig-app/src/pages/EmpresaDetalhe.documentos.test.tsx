import { screen, waitFor, within } from '@testing-library/react';
import { IDS, db } from '../mocks/dados';
import { server } from '../mocks/server';
import { formatarDataHora } from '../utils/datas';
import { renderizarRota } from '../test/renderizar';

const CND_ANTIGA = {
  id: '44444444-4444-4444-8444-0000000000aa',
  empresaId: IDS.empresaAlfa,
  tipoDocumentoId: IDS.tipoCndFederal,
  obraId: null,
  nomeArquivo: 'cnd-federal-antiga.pdf',
  formato: 'application/pdf' as const,
  tamanhoBytes: 120_000,
  enviadoEm: '2026-08-01T13:00:00Z',
  status: 'REJEITADO' as const,
  analisadoEm: '2026-08-02T14:30:00Z',
  analisadoPor: { login: 'maria.silva', nome: 'Maria Silva' },
  motivoRejeicao: 'Certidão vencida.',
  periodoInicio: null,
  periodoFim: null,
  enviadoComAtraso: false,
};

async function abrirAlfa() {
  const r = renderizarRota(`/empresas/${IDS.empresaAlfa}`);
  await screen.findByRole('heading', { level: 1, name: 'Alfa Engenharia Ltda' });
  const tabela = await screen.findByRole('table', { name: 'Documentos gerais da empresa' });
  return { ...r, tabela };
}

function linha(tabela: HTMLElement, documento: string) {
  return within(tabela).getByText(documento).closest('tr')!;
}

describe('Detalhe da empresa — documentos', () => {
  it('mostra a situação de cada tipo ativo em texto', async () => {
    const { tabela } = await abrirAlfa();
    expect(within(linha(tabela, 'Cartão CNPJ')).getByText('Aprovado')).toBeInTheDocument();
    expect(within(linha(tabela, 'CND Federal')).getByText('Rejeitado')).toBeInTheDocument();
    expect(within(linha(tabela, 'CND Federal')).getByText('Motivo: Documento ilegível, envie de novo em PDF.')).toBeInTheDocument();
    expect(within(linha(tabela, 'PCMSO')).getByText('Em análise')).toBeInTheDocument();
    expect(within(linha(tabela, 'PCMSO')).getByRole('link', { name: 'Analisar PCMSO' })).toBeInTheDocument();
    // Tipo desativado não entra na tabela dos exigidos.
    expect(within(tabela).queryByText('Alvará de funcionamento (antigo)')).not.toBeInTheDocument();
  });

  it('empresa sem envios vê "Pendente de envio" e o histórico desabilitado', async () => {
    renderizarRota(`/empresas/${IDS.empresaGama}`);
    const tabela = await screen.findByRole('table', { name: 'Documentos gerais da empresa' });
    const pcmso = linha(tabela, 'PCMSO');
    expect(within(pcmso).getByText('Pendente de envio')).toBeInTheDocument();
    expect(within(pcmso).getByText('Nenhum envio')).toBeInTheDocument();
    expect(within(pcmso).getByRole('button', { name: 'Histórico de PCMSO' })).toBeDisabled();
  });

  it('histórico lista do envio mais recente para o mais antigo com analista, data e motivo', async () => {
    db.envios.push({ ...CND_ANTIGA });
    const { usuario, tabela } = await abrirAlfa();
    await usuario.click(within(linha(tabela, 'CND Federal')).getByRole('button', { name: 'Histórico de CND Federal' }));

    const dialogo = screen.getByRole('dialog', { name: 'Histórico: CND Federal' });
    const envios = await within(dialogo).findAllByRole('listitem');
    expect(envios).toHaveLength(2);
    expect(envios[0]).toHaveTextContent('cnd-federal.jpg');
    expect(envios[0]).toHaveTextContent('Rejeitado por Analista Dev');
    expect(envios[0]).toHaveTextContent('Motivo: Documento ilegível, envie de novo em PDF.');

    expect(envios[1]).toHaveTextContent('cnd-federal-antiga.pdf');
    expect(envios[1]).toHaveTextContent(`Enviado em ${formatarDataHora(CND_ANTIGA.enviadoEm)}`);
    expect(envios[1]).toHaveTextContent(`Rejeitado por Maria Silva em ${formatarDataHora(CND_ANTIGA.analisadoEm)}`);
    expect(envios[1]).toHaveTextContent('Motivo: Certidão vencida.');
  });

  it('bloco "Tipos desativados" abre o histórico de um tipo desativado (mais recente primeiro)', async () => {
    const { usuario } = await abrirAlfa();
    const bloco = await screen.findByRole('region', { name: 'Tipos desativados' });
    expect(within(bloco).getByText('Alvará de funcionamento (antigo)')).toBeInTheDocument();
    expect(within(bloco).getByText('Inativo')).toBeInTheDocument();

    await usuario.click(within(bloco).getByRole('button', { name: 'Ver histórico de Alvará de funcionamento (antigo)' }));
    const dialogo = screen.getByRole('dialog', { name: 'Histórico: Alvará de funcionamento (antigo)' });
    const envios = await within(dialogo).findAllByRole('listitem');
    expect(envios).toHaveLength(2);
    expect(envios[0]).toHaveTextContent('alvara-2026.pdf');
    expect(envios[0]).toHaveTextContent('Aprovado por Analista Dev');
    expect(envios[1]).toHaveTextContent('alvara-2025.jpg');
    expect(envios[1]).toHaveTextContent('Rejeitado por Maria Silva');
    expect(envios[1]).toHaveTextContent('Motivo: Alvará vencido.');
  });

  it('tipo desativado sem envio da empresa mostra "Nenhum envio para este documento."', async () => {
    const { usuario } = renderizarRota(`/empresas/${IDS.empresaGama}`);
    const bloco = await screen.findByRole('region', { name: 'Tipos desativados' });
    await usuario.click(within(bloco).getByRole('button', { name: 'Ver histórico de Alvará de funcionamento (antigo)' }));
    const dialogo = screen.getByRole('dialog', { name: 'Histórico: Alvará de funcionamento (antigo)' });
    expect(await within(dialogo).findByText('Nenhum envio para este documento.')).toBeInTheDocument();
  });

  it('sem tipos desativados o bloco não aparece', async () => {
    for (const t of db.tipos) t.ativo = true;
    let tiposRespondidos = false;
    server.events.on('response:mocked', ({ request }) => {
      if (request.url.includes('/tipos-documento')) tiposRespondidos = true;
    });
    await abrirAlfa();
    await waitFor(() => expect(tiposRespondidos).toBe(true));
    server.events.removeAllListeners();
    // A tabela passa a incluir o tipo reativado; o bloco some.
    expect(await screen.findByText('Alvará de funcionamento (antigo)')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Tipos desativados' })).not.toBeInTheDocument();
  });

  it('separa os documentos gerais e um bloco por obra com vínculo ativo', async () => {
    const { tabela } = await abrirAlfa();
    expect(screen.getByRole('heading', { level: 2, name: 'Documentos gerais' })).toBeInTheDocument();
    // Tipo por obra nunca aparece nos gerais.
    expect(within(tabela).queryByText('ART da obra')).not.toBeInTheDocument();

    const vista = await screen.findByRole('table', { name: 'Documentos da obra Residencial Vista do Rio' });
    expect(within(linha(vista, 'ART da obra')).getByText('Aprovado')).toBeInTheDocument();
    expect(within(linha(vista, 'Ordem de serviço')).getByText('Pendente de envio')).toBeInTheDocument();

    const flor = await screen.findByRole('table', { name: 'Documentos da obra Condomínio Flor de Sal' });
    // Mesmo tipo, outra obra, outra situação.
    expect(within(linha(flor, 'ART da obra')).getByText('Em análise')).toBeInTheDocument();
    const bloco = screen.getByRole('region', { name: 'Condomínio Flor de Sal' });
    expect(within(bloco).getByText('Documentos desta obra: 0 de 1 aprovados')).toBeInTheDocument();
  });

  it('histórico de um documento da obra mostra só os envios daquela obra', async () => {
    const { usuario } = await abrirAlfa();
    const vista = await screen.findByRole('table', { name: 'Documentos da obra Residencial Vista do Rio' });
    await usuario.click(within(linha(vista, 'ART da obra')).getByRole('button', { name: 'Histórico de ART da obra' }));
    const dialogo = screen.getByRole('dialog', { name: 'Histórico: ART da obra' });
    expect(dialogo).toHaveTextContent('Obra: Residencial Vista do Rio');
    const envios = await within(dialogo).findAllByRole('listitem');
    expect(envios).toHaveLength(1);
    expect(envios[0]).toHaveTextContent('art-vista-do-rio.pdf');
  });

  it('obras com vínculo encerrado ficam recolhidas, só com histórico', async () => {
    const { usuario } = renderizarRota(`/empresas/${IDS.empresaGama}`);
    await screen.findByRole('heading', { level: 1, name: 'Gama Instalações Elétricas Ltda' });
    expect(await screen.findByText('Esta empresa não está em nenhuma obra no momento.', { exact: false })).toBeInTheDocument();
    const resumo = screen.getByText('Obras encerradas (1)');
    expect(screen.queryByRole('table', { name: 'Documentos da obra Residencial Vista do Rio' })).not.toBeInTheDocument();
    await usuario.click(resumo);
    const tabela = await screen.findByRole('table', { name: 'Documentos da obra Residencial Vista do Rio' });
    expect(within(linha(tabela, 'ART da obra')).getByText('Aprovado')).toBeInTheDocument();
    expect(screen.getByText(/Vínculo encerrado: só histórico/)).toBeInTheDocument();
  });

  it('?obra= de um vínculo encerrado já abre a seção recolhida', async () => {
    renderizarRota(`/empresas/${IDS.empresaGama}?obra=${IDS.obraVistaDoRio}`);
    expect(await screen.findByRole('table', { name: 'Documentos da obra Residencial Vista do Rio' })).toBeInTheDocument();
  });
});
