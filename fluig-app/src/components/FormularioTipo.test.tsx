import { screen, waitFor, within } from '@testing-library/react';
import { IDS, db } from '../mocks/dados';
import { server } from '../mocks/server';
import { renderizarRota } from '../test/renderizar';

async function abrirNovo() {
  const r = renderizarRota('/tipos-documento');
  await screen.findByRole('table', { name: 'Tipos de documento' });
  await r.usuario.click(screen.getByRole('button', { name: 'Novo tipo de documento' }));
  const dialogo = screen.getByRole('dialog', { name: 'Novo tipo de documento' });
  return { ...r, dialogo };
}

async function abrirEdicao(nome: string) {
  const r = renderizarRota('/tipos-documento');
  await screen.findByRole('table', { name: 'Tipos de documento' });
  await r.usuario.click(screen.getByRole('button', { name: `Editar ${nome}` }));
  const dialogo = screen.getByRole('dialog', { name: 'Editar tipo de documento' });
  return { ...r, dialogo };
}

/** Captura o corpo dos POST/PUT de tipo. */
function corposEnviados() {
  const corpos: unknown[] = [];
  server.events.on('request:start', async ({ request }) => {
    if (/\/tipos-documento/.test(request.url) && request.method !== 'GET') corpos.push(await request.clone().json());
  });
  return corpos;
}

describe('Formulário de tipo — periodicidade (003)', () => {
  afterEach(() => server.events.removeAllListeners());

  it('começa "Único", sem prazo; escolher Mensal mostra o prazo padrão 15 e a prévia em texto', async () => {
    const { usuario, dialogo } = await abrirNovo();
    const select = within(dialogo).getByLabelText('Com que frequência a empresa envia');
    expect(select).toHaveValue('UNICA');
    expect(within(dialogo).queryByLabelText(/Prazo para enviar/)).not.toBeInTheDocument();

    await usuario.selectOptions(select, 'MENSAL');
    expect(within(dialogo).getByLabelText(/Prazo para enviar \(dias após o fim do período\)/)).toHaveValue(15);
    expect(within(dialogo).getByText(/Mensal · um arquivo por mês, até o dia 15 do mês seguinte\./)).toBeInTheDocument();

    const prazo = within(dialogo).getByLabelText(/Prazo para enviar/);
    await usuario.clear(prazo);
    await usuario.type(prazo, '10');
    expect(within(dialogo).getByText(/até o dia 10 do mês seguinte/)).toBeInTheDocument();
  });

  it('oferece a lista pronta e os personalizados', async () => {
    const { dialogo } = await abrirNovo();
    const opcoes = within(within(dialogo).getByLabelText('Com que frequência a empresa envia'))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(opcoes).toEqual([
      'Único (um envio vale para sempre)',
      'Mensal',
      'Bimestral',
      'Trimestral',
      'Semestral',
      'Anual',
      'A cada N meses',
      'A cada N dias',
    ]);
  });

  it('"A cada N dias" pede N e cria o tipo com unidade DIAS', async () => {
    const corpos = corposEnviados();
    const { usuario, dialogo } = await abrirNovo();
    await usuario.type(within(dialogo).getByLabelText(/Nome/), 'Relatório de ponto');
    await usuario.click(within(dialogo).getByRole('radio', { name: /Geral da empresa/ }));
    await usuario.selectOptions(within(dialogo).getByLabelText('Com que frequência a empresa envia'), 'N_DIAS');
    await usuario.type(within(dialogo).getByLabelText(/A cada quantos dias/), '30');
    expect(within(dialogo).getByText(/A cada 30 dias · um arquivo a cada 30 dias, até 15 dias após o fim do período\./)).toBeInTheDocument();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(corpos[0]).toMatchObject({ periodicidade: { unidade: 'DIAS', intervalo: 30, prazoDias: 15 } });
    const tabela = screen.getByRole('table', { name: 'Tipos de documento' });
    const linha = (await within(tabela).findByText('Relatório de ponto')).closest('tr')!;
    expect(within(linha).getByText('A cada 30 dias · até 15 dias após o fim do período')).toBeInTheDocument();
  });

  it('valida as faixas antes de enviar (meses 1–24, prazo 0–90)', async () => {
    const corpos = corposEnviados();
    const { usuario, dialogo } = await abrirNovo();
    await usuario.type(within(dialogo).getByLabelText(/Nome/), 'Relatório especial');
    await usuario.click(within(dialogo).getByRole('radio', { name: /Geral da empresa/ }));
    await usuario.selectOptions(within(dialogo).getByLabelText('Com que frequência a empresa envia'), 'N_MESES');
    await usuario.type(within(dialogo).getByLabelText(/A cada quantos meses/), '25');
    const prazo = within(dialogo).getByLabelText(/Prazo para enviar/);
    await usuario.clear(prazo);
    await usuario.type(prazo, '91');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    expect(within(dialogo).getByText('Informe de 1 a 24 meses.')).toBeInTheDocument();
    expect(within(dialogo).getByText('Informe o prazo de 0 a 90 dias.')).toBeInTheDocument();
    expect(corpos).toHaveLength(0);
  });

  it('abre a edição com a periodicidade atual (Mensal, prazo 15)', async () => {
    const { dialogo } = await abrirEdicao('Guia do FGTS');
    expect(within(dialogo).getByLabelText('Com que frequência a empresa envia')).toHaveValue('MENSAL');
    expect(within(dialogo).getByLabelText(/Prazo para enviar/)).toHaveValue(15);
  });

  it('tipo com envios: mudar a periodicidade é recusado (409) com explicação', async () => {
    const { usuario, dialogo } = await abrirEdicao('Guia do FGTS');
    await usuario.selectOptions(within(dialogo).getByLabelText('Com que frequência a empresa envia'), 'UNICA');
    expect(within(dialogo).getByText(/A periodicidade só muda enquanto o tipo não tiver envios/)).toBeInTheDocument();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    expect(
      await within(dialogo).findByText(/A periodicidade só pode mudar enquanto o tipo não tiver envios\. O prazo pode mudar/),
    ).toBeInTheDocument();
    expect(db.tipos.find((t) => t.id === IDS.tipoGuiaFgts)!.periodicidade.unidade).toBe('MESES');
  });

  it('tipo com envios: o prazo muda', async () => {
    const { usuario, dialogo } = await abrirEdicao('Guia do FGTS');
    const prazo = within(dialogo).getByLabelText(/Prazo para enviar/);
    await usuario.clear(prazo);
    await usuario.type(prazo, '20');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(db.tipos.find((t) => t.id === IDS.tipoGuiaFgts)!.periodicidade.prazoDias).toBe(20);
    expect(await screen.findByText('Mensal · até o dia 20 do mês seguinte')).toBeInTheDocument();
  });
});
