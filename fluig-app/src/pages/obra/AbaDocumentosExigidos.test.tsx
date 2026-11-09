import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { IDS, db, definirPerfilMock } from '../../mocks/dados';
import { server } from '../../mocks/server';
import { renderizarRota } from '../../test/renderizar';

async function abrirAba(obraId: string) {
  const r = renderizarRota(`/obras/${obraId}?aba=documentos`);
  await screen.findByRole('tab', { name: /Documentos exigidos/, selected: true });
  const lista = await screen.findByRole('list', { name: 'Documentos por obra' });
  return { ...r, lista };
}

function itemDe(lista: HTMLElement, nome: string) {
  return within(lista).getByText(nome).closest('li')!;
}

describe('Aba "Documentos exigidos" da obra', () => {
  it('lista só os tipos por obra, com a situação de cada um escrita e a nota sobre os gerais', async () => {
    const { lista } = await abrirAba(IDS.obraFlorDeSal);
    expect(within(itemDe(lista, 'ART da obra')).getByText('Exigido')).toBeInTheDocument();
    expect(within(itemDe(lista, 'Ordem de serviço')).getByText('Não exigido')).toBeInTheDocument();
    expect(within(lista).queryByText('Cartão CNPJ')).not.toBeInTheDocument();
    expect(screen.getByText(/Também são exigidos os documentos gerais da empresa/)).toBeInTheDocument();
    expect(screen.getByText('1 documento por obra exigido.')).toBeInTheDocument();
  });

  it('cria um tipo novo pela aba, já "Por obra" e exigido nesta obra', async () => {
    const { usuario, lista } = await abrirAba(IDS.obraFlorDeSal);
    await usuario.click(screen.getByRole('button', { name: 'Novo tipo por obra' }));
    const modal = await screen.findByRole('dialog', { name: 'Novo tipo de documento' });
    // A abrangência é fixa: não há escolha no formulário.
    expect(within(modal).queryByRole('radio')).not.toBeInTheDocument();
    expect(within(modal).getByText(/criado com a abrangência “Por obra”/)).toBeInTheDocument();
    await usuario.type(within(modal).getByRole('textbox', { name: /Nome/ }), 'Laudo do canteiro');
    await usuario.click(within(modal).getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(/“Laudo do canteiro” foi cadastrado e já é exigido nesta obra/)).toBeInTheDocument();
    const tipo = db.tipos.find((x) => x.nome === 'Laudo do canteiro')!;
    expect(tipo.abrangencia).toBe('POR_OBRA');
    expect(db.obraTipos.some((m) => m.obraId === IDS.obraFlorDeSal && m.tipoDocumentoId === tipo.id)).toBe(true);
    await waitFor(() =>
      expect(within(itemDe(lista, 'Laudo do canteiro')).getByRole('checkbox', { name: 'Laudo do canteiro' })).toBeChecked(),
    );
  });

  it('usuário comum não vê "Novo tipo por obra"', async () => {
    definirPerfilMock('comum');
    await abrirAba(IDS.obraFlorDeSal);
    expect(screen.queryByRole('button', { name: 'Novo tipo por obra' })).not.toBeInTheDocument();
  });

  it('marca um tipo como exigido e salva na hora', async () => {
    const { usuario, lista } = await abrirAba(IDS.obraFlorDeSal);
    const caixa = within(itemDe(lista, 'Ordem de serviço')).getByRole('checkbox', { name: 'Ordem de serviço' });
    expect(caixa).not.toBeChecked();
    await usuario.click(caixa);
    expect(await screen.findByText(/“Ordem de serviço” agora é exigido nesta obra/)).toBeInTheDocument();
    expect(caixa).toBeChecked();
    expect(db.obraTipos.some((m) => m.obraId === IDS.obraFlorDeSal && m.tipoDocumentoId === IDS.tipoOrdemServico)).toBe(true);
    // A contagem da aba é atualizada.
    await waitFor(() => expect(screen.getByRole('tab', { name: /Documentos exigidos/ })).toHaveTextContent('2'));
  });

  it('desmarca um tipo e avisa que os envios ficam no histórico', async () => {
    const { usuario, lista } = await abrirAba(IDS.obraFlorDeSal);
    await usuario.click(within(itemDe(lista, 'ART da obra')).getByRole('checkbox', { name: 'ART da obra' }));
    expect(
      await screen.findByText(/“ART da obra” deixou de ser exigido nesta obra. Os envios já feitos continuam no histórico./),
    ).toBeInTheDocument();
    expect(db.obraTipos.some((m) => m.obraId === IDS.obraFlorDeSal && m.tipoDocumentoId === IDS.tipoArt)).toBe(false);
    // O envio por obra continua guardado.
    expect(db.envios.some((e) => e.id === IDS.envioAlfaArtFlorDeSal)).toBe(true);
  });

  it('erro ao salvar desfaz a marcação e mostra a mensagem', async () => {
    server.use(
      http.put('*/api/fluig/obras/:obraId/tipos-documento/:tipoId', () =>
        HttpResponse.json(
          { title: 'Só tipos de documento por obra podem ser exigidos de uma obra.', status: 400, code: 'TIPO_NAO_E_POR_OBRA' },
          { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    );
    const { usuario, lista } = await abrirAba(IDS.obraFlorDeSal);
    const caixa = within(itemDe(lista, 'PGR do canteiro')).getByRole('checkbox', { name: 'PGR do canteiro' });
    await usuario.click(caixa);
    expect(await screen.findByText('Só tipos de documento por obra podem ser exigidos de uma obra.')).toBeInTheDocument();
    expect(caixa).not.toBeChecked();
  });

  it('usuário comum vê a lista em modo leitura (sem caixas de seleção)', async () => {
    definirPerfilMock('comum');
    const { lista } = await abrirAba(IDS.obraVistaDoRio);
    expect(within(lista).queryAllByRole('checkbox')).toHaveLength(0);
    expect(within(itemDe(lista, 'ART da obra')).getByText('Exigido')).toBeInTheDocument();
    expect(within(itemDe(lista, 'PGR do canteiro')).getByText('Não exigido')).toBeInTheDocument();
  });

  it('sem tipos por obra mostra o estado vazio com a opção de cadastrar', async () => {
    db.tipos.splice(0, db.tipos.length, ...db.tipos.filter((t) => t.abrangencia === 'GERAL'));
    db.obraTipos.splice(0, db.obraTipos.length);
    renderizarRota(`/obras/${IDS.obraFlorDeSal}?aba=documentos`);
    expect(await screen.findByText('Nenhum tipo de documento por obra cadastrado.')).toBeInTheDocument();
    // O estado vazio oferece o mesmo "Novo tipo por obra" do cabeçalho.
    expect(screen.getAllByRole('button', { name: 'Novo tipo por obra' })).toHaveLength(2);
  });

  it('"Novo tipo por obra" também oferece a periodicidade (003)', async () => {
    const { usuario } = await abrirAba(IDS.obraFlorDeSal);
    await usuario.click(screen.getByRole('button', { name: 'Novo tipo por obra' }));
    const modal = await screen.findByRole('dialog', { name: 'Novo tipo de documento' });
    await usuario.type(within(modal).getByRole('textbox', { name: /Nome/ }), 'Relatório trimestral da obra');
    await usuario.selectOptions(within(modal).getByLabelText('Com que frequência a empresa envia'), 'TRIMESTRAL');
    const prazo = within(modal).getByLabelText(/Prazo para enviar/);
    await usuario.clear(prazo);
    await usuario.type(prazo, '10');
    expect(within(modal).getByText(/Trimestral · um arquivo a cada 3 meses, até 10 dias após o fim do período\./)).toBeInTheDocument();
    await usuario.click(within(modal).getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText(/“Relatório trimestral da obra” foi cadastrado/)).toBeInTheDocument();
    const tipo = db.tipos.find((x) => x.nome === 'Relatório trimestral da obra')!;
    expect(tipo.periodicidade).toEqual({ unidade: 'MESES', intervalo: 3, prazoDias: 10 });
    const lista = await screen.findByRole('list', { name: 'Documentos por obra' });
    await waitFor(() =>
      expect(
        within(itemDe(lista, 'Relatório trimestral da obra')).getByText(
          'Periódico: Trimestral · até 10 dias após o fim do período',
        ),
      ).toBeInTheDocument(),
    );
  });
});
