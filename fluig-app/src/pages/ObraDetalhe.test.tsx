import { screen, waitFor, within } from '@testing-library/react';
import { DATA_FIXA_TESTES, IDS, db, fixarRelogioMock, reiniciarDados } from '../mocks/dados';
import { renderizarRota } from '../test/renderizar';

describe('Detalhe da obra', () => {
  it('organiza a obra em abas e guarda a aba na URL', async () => {
    const { usuario, local } = renderizarRota(`/obras/${IDS.obraVistaDoRio}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Residencial Vista do Rio' })).toBeInTheDocument();
    const abas = screen.getByRole('tablist', { name: 'Seções da obra' });
    expect(within(abas).getByRole('tab', { name: /Empresas/ })).toHaveAttribute('aria-selected', 'true');
    expect(within(abas).getByRole('tab', { name: /Documentos exigidos/ })).toHaveTextContent('3');
    expect(within(abas).getByRole('tab', { name: /Vínculos encerrados/ })).toHaveTextContent('1');
    await usuario.click(within(abas).getByRole('tab', { name: /Vínculos encerrados/ }));
    expect(local()).toBe(`/obras/${IDS.obraVistaDoRio}?aba=encerrados`);
    expect(screen.getByRole('table', { name: 'Vínculos encerrados' })).toBeInTheDocument();
  });

  it('aba Empresas mostra o progresso dos documentos desta obra e, à parte, dos gerais', async () => {
    renderizarRota(`/obras/${IDS.obraVistaDoRio}`);
    const tabela = await screen.findByRole('table', { name: 'Empresas da obra' });
    const alfa = within(tabela).getByText('Alfa Engenharia Ltda').closest('tr')!;
    expect(within(alfa).getByText('11.222.333/0001-81')).toBeInTheDocument();
    expect(within(alfa).getByText('Acesso ativo')).toBeInTheDocument();
    // ART e relatório trimestral aprovados; ordem de serviço pendente.
    expect(within(alfa).getByText('Documentos desta obra: 2 de 3 aprovados')).toBeInTheDocument();
    expect(within(alfa).getByText('Gerais: 2 de 5 aprovados')).toBeInTheDocument();
    const zeta = within(tabela).getByText('Zeta Andaimes e Equipamentos Ltda').closest('tr')!;
    expect(within(zeta).getByText('Documentos desta obra: 0 de 3 aprovados')).toBeInTheDocument();
    expect(within(zeta).getByText('2 pendentes · 1 rejeitado')).toBeInTheDocument();
    // Vínculo encerrado não aparece entre as empresas.
    expect(within(tabela).queryByText('Gama Instalações Elétricas Ltda')).not.toBeInTheDocument();
  });

  it('clicar na empresa abre o detalhe dela no bloco da obra', async () => {
    renderizarRota(`/obras/${IDS.obraVistaDoRio}`);
    const tabela = await screen.findByRole('table', { name: 'Empresas da obra' });
    expect(within(tabela).getByRole('link', { name: 'Alfa Engenharia Ltda' })).toHaveAttribute(
      'href',
      `/empresas/${IDS.empresaAlfa}?obra=${IDS.obraVistaDoRio}`,
    );
  });

  it('vincula uma empresa e ela aparece na tabela (sem duplicar)', async () => {
    const { usuario } = renderizarRota(`/obras/${IDS.obraFlorDeSal}`);
    await screen.findByRole('heading', { level: 1, name: 'Condomínio Flor de Sal' });
    await usuario.click(screen.getByRole('button', { name: 'Vincular empresa' }));
    const dialogo = screen.getByRole('dialog', { name: 'Vincular empresa à obra' });
    await usuario.type(within(dialogo).getByLabelText('Buscar empresa'), 'gama');
    const item = (await within(dialogo).findByText('Gama Instalações Elétricas Ltda')).closest('li')!;
    await usuario.click(within(item).getByRole('button', { name: /Vincular/ }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const tabela = screen.getByRole('table', { name: 'Empresas da obra' });
    expect(await within(tabela).findByText('Gama Instalações Elétricas Ltda')).toBeInTheDocument();
    expect(within(tabela).getAllByText('Gama Instalações Elétricas Ltda')).toHaveLength(1);
  });

  it('empresa já vinculada aparece como "Já vinculada"', async () => {
    const { usuario } = renderizarRota(`/obras/${IDS.obraFlorDeSal}`);
    await screen.findByRole('heading', { level: 1, name: 'Condomínio Flor de Sal' });
    await usuario.click(screen.getByRole('button', { name: 'Vincular empresa' }));
    const dialogo = screen.getByRole('dialog', { name: 'Vincular empresa à obra' });
    await usuario.type(within(dialogo).getByLabelText('Buscar empresa'), 'alfa');
    const item = (await within(dialogo).findByText('Alfa Engenharia Ltda')).closest('li')!;
    expect(within(item).getByText('Já vinculada')).toBeInTheDocument();
  });

  it('encerrar vínculo pede confirmação com a quantidade de envios na obra', async () => {
    const { usuario } = renderizarRota(`/obras/${IDS.obraFlorDeSal}`);
    const tabela = await screen.findByRole('table', { name: 'Empresas da obra' });
    const linha = within(tabela).getByText('Alfa Engenharia Ltda').closest('tr')!;
    await usuario.click(within(linha).getByRole('button', { name: 'Encerrar vínculo de Alfa Engenharia Ltda' }));
    const dialogo = screen.getByRole('dialog', { name: 'Encerrar vínculo?' });
    expect(dialogo).toHaveTextContent(
      'A empresa já enviou 1 documento nesta obra. O histórico continua guardado e volta se você vincular de novo.',
    );
    await usuario.click(within(dialogo).getByRole('button', { name: 'Encerrar vínculo' }));

    await waitFor(() => expect(within(tabela).queryByText('Alfa Engenharia Ltda')).not.toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent('O vínculo de Alfa Engenharia Ltda com a obra foi encerrado.');
    // O vínculo continua guardado, encerrado.
    const vinculo = db.vinculos.find((v) => v.obraId === IDS.obraFlorDeSal && v.empresaId === IDS.empresaAlfa)!;
    expect(vinculo.ativo).toBe(false);
    expect(screen.getByRole('tab', { name: /Vínculos encerrados/ })).toHaveTextContent('1');
  });

  it('confirmação com vários envios usa o plural', async () => {
    const rejeitado = db.envios.find((e) => e.id === IDS.envioZetaOrdemRejeitado)!;
    db.envios.push({ ...rejeitado, id: 'reenvio-zeta', status: 'EM_ANALISE', analisadoEm: null, analisadoPor: null, motivoRejeicao: null });
    const { usuario } = renderizarRota(`/obras/${IDS.obraVistaDoRio}`);
    const tabela = await screen.findByRole('table', { name: 'Empresas da obra' });
    const linha = within(tabela).getByText('Zeta Andaimes e Equipamentos Ltda').closest('tr')!;
    await usuario.click(within(linha).getByRole('button', { name: /Encerrar vínculo/ }));
    expect(screen.getByRole('dialog', { name: 'Encerrar vínculo?' })).toHaveTextContent(
      'A empresa já enviou 2 documentos nesta obra. O histórico continua guardado e volta se você vincular de novo.',
    );
  });

  it('aba "Vínculos encerrados" mostra quem encerrou, quando, os envios e o acesso ao histórico', async () => {
    renderizarRota(`/obras/${IDS.obraVistaDoRio}?aba=encerrados`);
    const tabela = await screen.findByRole('table', { name: 'Vínculos encerrados' });
    const gama = within(tabela).getByText('Gama Instalações Elétricas Ltda').closest('tr')!;
    expect(within(gama).getByText('por maria.silva')).toBeInTheDocument();
    expect(within(gama).getByText('1 envio')).toBeInTheDocument();
    expect(within(gama).getByRole('link', { name: /Ver histórico de Gama/ })).toHaveAttribute(
      'href',
      `/empresas/${IDS.empresaGama}?obra=${IDS.obraVistaDoRio}`,
    );
  });

  it('reabre o vínculo encerrado pela aba e a empresa volta com o histórico', async () => {
    const { usuario } = renderizarRota(`/obras/${IDS.obraVistaDoRio}?aba=encerrados`);
    const tabela = await screen.findByRole('table', { name: 'Vínculos encerrados' });
    await usuario.click(within(tabela).getByRole('button', { name: 'Reabrir vínculo de Gama Instalações Elétricas Ltda' }));
    expect(await screen.findByText(/O vínculo de Gama Instalações Elétricas Ltda com a obra foi reaberto/)).toBeInTheDocument();
    expect(await screen.findByText('Nenhum vínculo encerrado nesta obra.')).toBeInTheDocument();

    await usuario.click(screen.getByRole('tab', { name: /Empresas/ }));
    const empresas = screen.getByRole('table', { name: 'Empresas da obra' });
    const gama = within(empresas).getByText('Gama Instalações Elétricas Ltda').closest('tr')!;
    // O ART aprovado antes do encerramento volta a valer.
    expect(within(gama).getByText('Documentos desta obra: 1 de 3 aprovados')).toBeInTheDocument();
  });

  it('o modal de vincular oferece reabrir o vínculo encerrado', async () => {
    const { usuario } = renderizarRota(`/obras/${IDS.obraVistaDoRio}`);
    await screen.findByRole('table', { name: 'Empresas da obra' });
    await usuario.click(screen.getByRole('button', { name: 'Vincular empresa' }));
    const dialogo = screen.getByRole('dialog', { name: 'Vincular empresa à obra' });
    await usuario.type(within(dialogo).getByLabelText('Buscar empresa'), 'gama');
    const item = (await within(dialogo).findByText('Gama Instalações Elétricas Ltda')).closest('li')!;
    expect(within(item).getByText(/Vínculo encerrado/)).toBeInTheDocument();
    await usuario.click(within(item).getByRole('button', { name: 'Reabrir vínculo de Gama Instalações Elétricas Ltda' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent('foi reaberto');
    const tabela = screen.getByRole('table', { name: 'Empresas da obra' });
    expect(await within(tabela).findByText('Gama Instalações Elétricas Ltda')).toBeInTheDocument();
  });

  it('obra inexistente mostra a mensagem de não encontrado', async () => {
    renderizarRota('/obras/99999999-9999-4999-8999-999999999999');
    expect(await screen.findByText('Não encontramos o que você procurou.')).toBeInTheDocument();
  });

  it('aba Empresas mostra os períodos atrasados dos documentos da obra (003)', async () => {
    fixarRelogioMock(DATA_FIXA_TESTES);
    reiniciarDados();
    // Zeta vinculada desde maio: o trimestre jul–set (cobrado desde a marcação) venceu em 10/10.
    db.vinculos.find((v) => v.obraId === IDS.obraVistaDoRio && v.empresaId === IDS.empresaZeta)!.vinculadoEm =
      '2026-05-10T15:00:00.000Z';
    renderizarRota(`/obras/${IDS.obraVistaDoRio}`);
    const tabela = await screen.findByRole('table', { name: 'Empresas da obra' });
    const zeta = within(tabela).getByText('Zeta Andaimes e Equipamentos Ltda').closest('tr')!;
    expect(within(zeta).getByText('1 período atrasado')).toBeInTheDocument();
    const beta = within(tabela).getByText('Beta Serviços de Montagem S.A.').closest('tr')!;
    expect(within(beta).queryByText(/período atrasado|períodos atrasados/)).not.toBeInTheDocument();
  });
});
