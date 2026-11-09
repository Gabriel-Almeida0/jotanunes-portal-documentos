import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api/client';
import { banco, resetarDados } from '../mocks/dados';
import { arquivoPdf, conectarComo, EMPRESA_ALFA, renderizarPortal, rotaAtual } from '../test/utils';

// Data fixa: FGTS (mensal, prazo 15) cobrado desde julho/2026 → julho a outubro; relatório trimestral
// (prazo 10) marcado no Atlântico em março/2026 → Mar–Mai, Jun–Ago e Set–Nov.
const HOJE = new Date('2026-10-26T15:00:00Z');

const idObra = (nome: string) => banco.obras.find((o) => o.nome === nome)!.id;
const idTipo = (nome: string) => banco.tipos.find((t) => t.nome === nome)!.id;

const periodo = (rotulo: string) => within(screen.getByRole('article', { name: rotulo }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: HOJE });
  resetarDados();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Documento periódico no resumo', () => {
  it('cartão do FGTS mostra periodicidade, resumo, próximo período e "Ver períodos"', async () => {
    await conectarComo(EMPRESA_ALFA.cnpj, EMPRESA_ALFA.senha);
    const { user } = renderizarPortal('/documentos');
    const cartao = within(await screen.findByRole('article', { name: 'Guia do FGTS' }));
    expect(cartao.getByText('Mensal · até o dia 15 do mês seguinte')).toBeInTheDocument();
    expect(cartao.getByText('2 atrasados · 1 em análise · 1 aprovado')).toBeInTheDocument();
    expect(
      cartao.getByText('Próximo: Agosto/2026 · prazo venceu em 15/09/2026'),
    ).toBeInTheDocument();
    expect(cartao.queryByRole('button', { name: /Enviar/ })).not.toBeInTheDocument();

    // Atrasado vem primeiro entre os gerais.
    const gerais = within(screen.getByRole('list', { name: 'Documentos gerais exigidos' }));
    expect(within(gerais.getAllByRole('article')[0]).getByRole('heading').textContent).toBe(
      'Guia do FGTS',
    );

    await user.click(cartao.getByRole('link', { name: 'Ver períodos de Guia do FGTS' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Guia do FGTS' }),
    ).toBeInTheDocument();
    expect(rotaAtual()).toBe(`/documentos/${idTipo('Guia do FGTS')}/periodos`);
  });

  it('cartão da obra mostra os períodos atrasados', async () => {
    await conectarComo(EMPRESA_ALFA.cnpj, EMPRESA_ALFA.senha);
    renderizarPortal('/documentos');
    const atlantico = within(await screen.findByRole('article', { name: 'Edifício Atlântico' }));
    expect(atlantico.getByText('1 período atrasado')).toBeInTheDocument();
  });
});

describe('PeriodosDocumento', () => {
  it('lista os que pedem ação primeiro (mais recente antes), o atual e os anteriores recolhidos', async () => {
    await conectarComo(EMPRESA_ALFA.cnpj, EMPRESA_ALFA.senha);
    renderizarPortal(`/documentos/${idTipo('Guia do FGTS')}/periodos`);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Guia do FGTS' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Mensal · até o dia 15 do mês seguinte')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Voltar para meus documentos/ })).toHaveAttribute(
      'href',
      '/documentos',
    );

    const visiveis = within(screen.getByRole('list', { name: 'Períodos' }))
      .getAllByRole('article')
      .map((a) => within(a).getByRole('heading').textContent);
    expect(visiveis).toEqual(['Setembro/2026', 'Agosto/2026', 'Outubro/2026']);

    const anteriores = screen.getByText('Períodos anteriores (1)').closest('details')!;
    expect(anteriores).not.toHaveAttribute('open');
    expect(within(anteriores).getByRole('heading', { name: 'Julho/2026' })).toBeInTheDocument();

    const setembro = periodo('Setembro/2026');
    expect(setembro.getByText('Prazo: 15/10/2026')).toBeInTheDocument();
    expect(setembro.getByText('Rejeitado')).toBeInTheDocument();
    expect(setembro.getByText('Atrasado')).toBeInTheDocument();
    expect(setembro.getByText('Motivo:').parentElement).toHaveTextContent(
      'Motivo: Falta o comprovante de pagamento.',
    );
    expect(setembro.getByRole('button', { name: 'Enviar novo arquivo' })).toBeInTheDocument();

    const agosto = periodo('Agosto/2026');
    expect(agosto.getByText('Atrasado')).toBeInTheDocument();
    expect(agosto.queryByText('Pendente de envio')).not.toBeInTheDocument();
    expect(agosto.getByRole('button', { name: 'Enviar documento' })).toBeInTheDocument();

    // Em análise e aprovado: sem envio.
    expect(periodo('Outubro/2026').getByText('Em análise')).toBeInTheDocument();
    expect(periodo('Outubro/2026').queryByRole('button', { name: /Enviar/ })).toBeNull();
    const julho = within(within(anteriores).getByRole('article', { name: 'Julho/2026' }));
    expect(julho.getByText('Aprovado')).toBeInTheDocument();
    expect(julho.getByText('Enviado com atraso')).toBeInTheDocument();
    expect(julho.queryByRole('button', { name: /Enviar/ })).toBeNull();
  });

  it('enviar para um período atrasado muda só aquele período e marca "enviado com atraso"', async () => {
    await conectarComo(EMPRESA_ALFA.cnpj, EMPRESA_ALFA.senha);
    const { user } = renderizarPortal(`/documentos/${idTipo('Guia do FGTS')}/periodos`);
    await screen.findByRole('article', { name: 'Agosto/2026' });

    await user.upload(
      screen.getByLabelText('Arquivo para Guia do FGTS, Agosto/2026'),
      arquivoPdf('fgts-agosto.pdf'),
    );
    await user.click(periodo('Agosto/2026').getByRole('button', { name: 'Enviar arquivo' }));

    expect(
      await screen.findByText(/Recebemos o arquivo de Guia do FGTS de Agosto\/2026/),
    ).toBeInTheDocument();
    await waitFor(() => expect(periodo('Agosto/2026').getByText('Em análise')).toBeInTheDocument());
    expect(periodo('Agosto/2026').getByText('Enviado com atraso')).toBeInTheDocument();
    expect(periodo('Setembro/2026').getByText('Rejeitado')).toBeInTheDocument();

    const novo = banco.envios.find((e) => e.nomeArquivo === 'fgts-agosto.pdf')!;
    expect(novo.periodo?.inicio).toBe('2026-08-01');
    expect(novo.enviadoComAtraso).toBe(true);
  });

  it('histórico do período mostra só os envios daquele período', async () => {
    await conectarComo(EMPRESA_ALFA.cnpj, EMPRESA_ALFA.senha);
    const tipo = idTipo('Guia do FGTS');
    const { user } = renderizarPortal(`/documentos/${tipo}/periodos`);
    await user.click(
      await screen.findByRole('link', { name: 'Ver histórico de envios de Setembro/2026' }),
    );
    expect(rotaAtual()).toBe(`/documentos/${tipo}`);
    const secao = within(await screen.findByRole('region', { name: 'Envios (1)' }));
    expect(screen.getByText('Período: Setembro/2026')).toBeInTheDocument();
    expect(secao.getByText('Motivo:').parentElement).toHaveTextContent(
      'Falta o comprovante de pagamento.',
    );
    // Documento periódico: o envio é feito pela página de períodos.
    expect(screen.queryByRole('button', { name: /Enviar/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Voltar para os períodos/ })).toHaveAttribute(
      'href',
      `/documentos/${tipo}/periodos`,
    );
  });

  it('na obra: mostra a obra, volta para a obra e envia no contexto dela', async () => {
    await conectarComo(EMPRESA_ALFA.cnpj, EMPRESA_ALFA.senha);
    const atlantico = idObra('Edifício Atlântico');
    const tipo = idTipo('Relatório trimestral de segurança');
    const { user } = renderizarPortal(`/obras/${atlantico}`);

    const cartao = within(
      await screen.findByRole('article', { name: 'Relatório trimestral de segurança' }),
    );
    expect(cartao.getByText('Trimestral · até 10 dias após o fim do período')).toBeInTheDocument();
    expect(cartao.getByText('1 atrasado · 1 a enviar · 1 aprovado')).toBeInTheDocument();
    await user.click(
      cartao.getByRole('link', { name: 'Ver períodos de Relatório trimestral de segurança' }),
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Relatório trimestral de segurança' }),
    ).toBeInTheDocument();
    expect(rotaAtual()).toBe(`/obras/${atlantico}/documentos/${tipo}/periodos`);
    expect(screen.getByTestId('contexto-obra')).toHaveTextContent(
      'Obra: Edifício Atlântico · Maceió/AL',
    );
    expect(
      screen.getByRole('link', { name: /Voltar para a obra Edifício Atlântico/ }),
    ).toHaveAttribute('href', `/obras/${atlantico}`);
    expect(periodo('Jun–Ago/2026').getByText('Prazo: 10/09/2026')).toBeInTheDocument();
    expect(periodo('Set–Nov/2026').getByText('Pendente de envio')).toBeInTheDocument();

    await user.upload(
      screen.getByLabelText('Arquivo para Relatório trimestral de segurança, Set–Nov/2026'),
      arquivoPdf('relatorio-tri-3.pdf'),
    );
    await user.click(periodo('Set–Nov/2026').getByRole('button', { name: 'Enviar arquivo' }));
    await waitFor(() =>
      expect(periodo('Set–Nov/2026').getByText('Em análise')).toBeInTheDocument(),
    );
    expect(periodo('Set–Nov/2026').queryByText('Enviado com atraso')).not.toBeInTheDocument();
    const novo = banco.envios.find((e) => e.nomeArquivo === 'relatorio-tri-3.pdf')!;
    expect(novo.obraId).toBe(atlantico);
    expect(novo.periodo?.inicio).toBe('2026-09-01');
    expect(novo.enviadoComAtraso).toBe(false);
  });

  it('documento único não tem página de períodos', async () => {
    await conectarComo(EMPRESA_ALFA.cnpj, EMPRESA_ALFA.senha);
    renderizarPortal(`/documentos/${idTipo('Cartão CNPJ')}/periodos`);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Períodos do documento' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Não encontramos o que você procurou.')).toBeInTheDocument();
  });

  it('mock segue o contrato: período obrigatório, futuro → 404, já em análise → 409', async () => {
    await conectarComo(EMPRESA_ALFA.cnpj, EMPRESA_ALFA.senha);
    const fgts = idTipo('Guia do FGTS');
    await expect(api.enviarDocumento(fgts, arquivoPdf())).rejects.toMatchObject({
      code: 'PERIODO_OBRIGATORIO',
    });
    await expect(
      api.enviarDocumento(idTipo('Cartão CNPJ'), arquivoPdf(), '2026-10-01'),
    ).rejects.toMatchObject({ code: 'PERIODO_OBRIGATORIO' });
    await expect(api.enviarDocumento(fgts, arquivoPdf(), '2026-11-01')).rejects.toMatchObject({
      code: 'NAO_ENCONTRADO',
    });
    await expect(api.enviarDocumento(fgts, arquivoPdf(), '2026-08-15')).rejects.toMatchObject({
      code: 'NAO_ENCONTRADO',
    });
    await expect(api.enviarDocumento(fgts, arquivoPdf(), '2026-10-01')).rejects.toMatchObject({
      code: 'ENVIO_NAO_PERMITIDO',
    });
    // Obra sem vínculo ativo → 404.
    await expect(
      api.listarPeriodosObra(
        idObra('Condomínio Mar Azul'),
        idTipo('Relatório trimestral de segurança'),
      ),
    ).rejects.toMatchObject({ code: 'NAO_ENCONTRADO' });
  });
});
