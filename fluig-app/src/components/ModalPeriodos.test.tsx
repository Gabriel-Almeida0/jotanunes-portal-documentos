import { screen, within } from '@testing-library/react';
import { DATA_FIXA_TESTES, IDS, fixarRelogioMock, reiniciarDados } from '../mocks/dados';
import { renderizarRota } from '../test/renderizar';

/** Com a data fixa (26/10/2026): Guia do FGTS da Alfa cobrada desde 26/07/2026. */
describe('Períodos de um documento periódico (ModalPeriodos)', () => {
  beforeEach(() => {
    fixarRelogioMock(DATA_FIXA_TESTES);
    reiniciarDados();
  });

  async function abrirFgtsAlfa() {
    const r = renderizarRota(`/empresas/${IDS.empresaAlfa}`);
    const tabela = await screen.findByRole('table', { name: 'Documentos gerais da empresa' }, { timeout: 5000 });
    const fgts = within(tabela).getByText('Guia do FGTS').closest('tr')!;
    return { ...r, fgts };
  }

  it('a linha do documento periódico mostra a regra, "Atrasado" e o resumo dos períodos', async () => {
    const { fgts } = await abrirFgtsAlfa();
    expect(within(fgts).getByText('Mensal · até o dia 15 do mês seguinte')).toBeInTheDocument();
    expect(within(fgts).getByText('Atrasado')).toBeInTheDocument();
    expect(within(fgts).getByText(/1 atrasado · 1 a enviar no prazo · 1 em análise · 1 aprovado/)).toBeInTheDocument();
    expect(within(fgts).getByRole('button', { name: 'Ver períodos de Guia do FGTS' })).toBeInTheDocument();
  });

  it('lista os atrasados primeiro, depois os que pedem ação e os em análise; os resolvidos ficam recolhidos', async () => {
    const { usuario, fgts } = await abrirFgtsAlfa();
    await usuario.click(within(fgts).getByRole('button', { name: 'Ver períodos de Guia do FGTS' }));
    const dialogo = screen.getByRole('dialog', { name: 'Períodos: Guia do FGTS' });
    const lista = await within(dialogo).findByRole('list', { name: 'Períodos' });
    const itens = within(lista).getAllByRole('listitem');
    expect(itens.map((i) => i.getAttribute('aria-label'))).toEqual(['Setembro/2026', 'Outubro/2026', 'Agosto/2026']);

    expect(within(itens[0]).getByText('Atrasado')).toBeInTheDocument();
    expect(within(itens[0]).getByText(/Prazo: 15\/10\/2026/)).toBeInTheDocument();
    expect(within(itens[1]).getByText('Pendente de envio')).toBeInTheDocument();
    expect(within(itens[2]).getByText('Em análise')).toBeInTheDocument();
    expect(within(itens[2]).getByText('Com atraso')).toBeInTheDocument();
    expect(within(itens[2]).getByRole('link', { name: 'Analisar de Agosto/2026' })).toHaveAttribute(
      'href',
      `/analise/${IDS.envioAlfaFgtsAtrasado}`,
    );

    // Julho (aprovado) fica em "Períodos anteriores", com quem analisou.
    expect(within(dialogo).getByText('Períodos anteriores (1)')).toBeInTheDocument();
    const anteriores = within(dialogo).getByRole('list', { name: 'Períodos anteriores', hidden: true });
    const julho = within(anteriores).getByRole('listitem', { name: 'Julho/2026', hidden: true });
    expect(within(julho).getByText('Aprovado')).toBeInTheDocument();
    expect(within(julho).getByText('Analista Dev')).toBeInTheDocument();
  });

  it('no bloco da obra abre os períodos daquela obra', async () => {
    const { usuario } = renderizarRota(`/empresas/${IDS.empresaAlfa}`);
    const bloco = await screen.findByRole('table', { name: 'Documentos da obra Residencial Vista do Rio' });
    const linha = (await within(bloco).findByText('Relatório trimestral')).closest('tr')!;
    expect(within(linha).getByText('Trimestral · até 10 dias após o fim do período')).toBeInTheDocument();
    await usuario.click(within(linha).getByRole('button', { name: 'Ver períodos de Relatório trimestral' }));
    const dialogo = screen.getByRole('dialog', { name: 'Períodos: Relatório trimestral' });
    expect(within(dialogo).getByText(/Obra: Residencial Vista do Rio/)).toBeInTheDocument();
    const item = await within(dialogo).findByRole('listitem', { name: 'Set–Nov/2026' });
    expect(within(item).getByText('Aprovado')).toBeInTheDocument();
    expect(within(item).getByText(/Prazo: 10\/12\/2026/)).toBeInTheDocument();
  });

  it('documento único continua sem períodos', async () => {
    const r = renderizarRota(`/empresas/${IDS.empresaAlfa}`);
    const tabela = await screen.findByRole('table', { name: 'Documentos gerais da empresa' }, { timeout: 5000 });
    const cnpj = within(tabela).getByText('Cartão CNPJ').closest('tr')!;
    expect(within(cnpj).queryByRole('button', { name: /Ver períodos/ })).not.toBeInTheDocument();
    expect(r.local()).toBe(`/empresas/${IDS.empresaAlfa}`);
  });
});
